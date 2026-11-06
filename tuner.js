// YIN: cumulative mean normalized difference, followed by parabolic refinement.
// Analysis is downsampled to <= 12 kHz to keep mobile CPU cost bounded.
export function analysePitch(input, sampleRate, {minHz = 50, maxHz = 1000} = {}) {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || input.length < 1024) return {hz:null, confidence:0, rms:0};
  const stride = Math.max(1, Math.floor(sampleRate / 12000));
  const rate = sampleRate / stride;
  const size = Math.floor(input.length / stride);
  const signal = new Float64Array(size);
  let mean=0, energy=0;
  for (const sample of input) { if (!Number.isFinite(sample)) return {hz:null,confidence:0,rms:0}; mean+=sample; }
  mean/=input.length;
  for (let i=0;i<input.length;i++) energy+=(input[i]-mean)**2;
  const rms=Math.sqrt(energy/input.length);
  if (rms < 0.00001) return {hz:null, confidence:0, rms};
  // Bounded normalization helps quiet inputs without altering their pitch.
  const gain=Math.min(64, 0.08/rms);
  for (let i=0;i<size;i++) { for(let j=0;j<stride;j++) signal[i]+=(input[i*stride+j]-mean)*gain; signal[i]/=stride; }
  const minLag=Math.max(2,Math.floor(rate/maxHz)), maxLag=Math.min(Math.ceil(rate/minHz),Math.floor(size/2)-1);
  const window=size-maxLag;
  if (window < maxLag || maxLag<=minLag) return {hz:null,confidence:0,rms};
  const difference=new Float64Array(maxLag+2);
  let sum=0;
  for(let lag=1;lag<=maxLag+1;lag++) {
    let value=0;
    for(let i=0;i<window-1;i++) value+=(signal[i]-signal[i+lag])**2;
    sum+=value; difference[lag]=sum ? value*lag/sum : 1;
  }
  let chosen=0;
  for(let lag=minLag;lag<maxLag;lag++) {
    if(difference[lag]<0.15) {
      while(lag<maxLag&&difference[lag+1]<difference[lag])lag++;
      chosen=lag;break;
    }
  }
  if(!chosen) return {hz:null,confidence:0,rms};
  // A strong second harmonic can create an early trough. Prefer a substantially
  // deeper trough at a multiple, but never double a clean fundamental needlessly.
  const first=chosen;
  for(let multiple=2;multiple<=4;multiple++) {
    const target=first*multiple;
    if(target+2>maxLag)break;
    let best=target;
    for(let lag=target-2;lag<=target+2;lag++)if(difference[lag]<difference[best])best=lag;
    if(difference[best]<difference[chosen]*0.2&&difference[chosen]>0.015)chosen=best;
  }
  const a=difference[chosen-1], b=difference[chosen], c=difference[chosen+1];
  const denominator=a-2*b+c;
  const correction=denominator ? Math.max(-1,Math.min(1,0.5*(a-c)/denominator)) : 0;
  const hz=rate/(chosen+correction);
  return {hz:hz>=minHz&&hz<=maxHz?hz:null,confidence:Math.max(0,1-b),rms,gain};
}

export class GuitarTuner {
  constructor(){this.noiseFloor=0.000008;this.history=[];this.smoothed=null;this.lastGood=-Infinity;}
  process(samples,rate,now=performance.now()) {
    const result=analysePitch(samples,rate);
    const {rms,confidence}=result;
    const db=20*Math.log10(Math.max(rms,1e-8));
    const gate=Math.max(0.000012,this.noiseFloor*1.3);
    const accepted=result.hz&&confidence>=0.87&&rms>=gate;
    if(!result.hz || confidence<0.7) {
      // Learn ambient sound only from unpitched frames; a ringing note must not
      // raise its own gate and disappear as it decays.
      const speed=rms<this.noiseFloor?0.25:0.12;
      this.noiseFloor+=(rms-this.noiseFloor)*speed;
    }
    const sensitivity=accepted ? result.gain : 1;
    let status=rms<gate?'weak':'noise';
    if(accepted) {
      const cents=1200*Math.log2(result.hz);
      if(this.history.length&&Math.abs(cents-this.history.at(-1))>45)this.history=[];
      this.history.push(cents);this.history=this.history.slice(-5);
      if(this.history.length>=3) {
        const sorted=[...this.history].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];
        this.smoothed=this.smoothed===null||Math.abs(median-this.smoothed)>70?median:this.smoothed+0.4*(median-this.smoothed);
        this.lastGood=now;status='locked';
      }else status='settling';
    }else this.history=[];
    if(now-this.lastGood>300)this.smoothed=null;
    const hz=status==='locked'&&this.smoothed!==null?2**(this.smoothed/1200):null;
    return {hz,rms,db,confidence,noiseFloor:this.noiseFloor,sensitivity,status,level:Math.max(0,Math.min(1,(db+90)/75))};
  }
}

export function microphoneConstraints(mediaDevices) {
  const supported=mediaDevices.getSupportedConstraints?.() || {};
  const audio={};
  for(const name of ['echoCancellation','noiseSuppression','autoGainControl']) {
    if(supported[name]!==false)audio[name]={ideal:false};
  }
  return {audio};
}
