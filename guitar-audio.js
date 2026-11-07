// Fractional-delay string synthesis, with a resonant body and varied pick attacks.
export const openGuitar=[82.4069,110,146.8324,195.9977,246.9417,329.6276];
export const practiceChords={G:[3,2,0,0,0,3],D:[-1,-1,0,2,3,2],Em:[0,2,2,0,0,0],C:[-1,3,2,0,1,0],Am:[-1,0,2,2,1,0],E:[0,2,2,1,0,0],A:[-1,0,2,2,2,0],Dm:[-1,-1,0,2,3,1],F:[1,3,3,2,1,1],Bm:[-1,2,4,4,3,2],D7:[-1,-1,0,2,1,2],G7:[3,2,0,0,0,1]};
const sampleCache=new WeakMap();
// Measured offsets of the bundled samples' sustained fundamentals from A440.
// Correct the soundfont's tuning before transposing to a fretted note.
const samplePitchOffsets=[-3,17,-1,-8,0,-1];
export function loadGuitarSamples(ctx){
  if(!sampleCache.has(ctx)){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  sampleCache.set(ctx,Promise.all(['E2','A2','D3','G3','B3','E4'].map(async note=>{
    const response=await fetch(new URL('./sounds/guitar/'+note+'.mp3',import.meta.url),{signal:controller.signal});if(!response.ok)throw new Error('Sample unavailable');
    const decoded=await ctx.decodeAudioData(await response.arrayBuffer()),data=decoded.getChannelData(0);
    let peak=0;for(const sample of data)peak=Math.max(peak,Math.abs(sample));
    if(peak<.001)throw new Error('Empty guitar sample');
    let first=0;while(first<data.length&&Math.abs(data[first])<peak*.012)first++;
    first=Math.max(0,first-Math.round(decoded.sampleRate*.002));
    const buffer=ctx.createBuffer(1,data.length-first,decoded.sampleRate),output=buffer.getChannelData(0);
    for(let i=0;i<output.length;i++)output[i]=data[first+i]*(.75/peak)*Math.min(1,i/(decoded.sampleRate*.0015))*Math.min(1,(output.length-i)/(decoded.sampleRate*.04));
    return buffer;
  })).catch(()=>{controller.abort();return null}).finally(()=>clearTimeout(timeout)));
  }
  return sampleCache.get(ctx);
}
export function strumNotes(chord='G',upstroke=false){
  const pitches=(practiceChords[chord]||practiceChords.G).flatMap((fret,string)=>fret<0?[]:[{string,frequency:openGuitar[string]*2**(fret/12)}]);
  return upstroke?pitches.reverse():pitches;
}
export function pluckedString(frequency,sampleRate,seconds=1.7,random=Math.random){
  if(!(frequency>=40&&frequency<=2000&&sampleRate>=8000&&seconds>0&&seconds<=5))throw new Error('Invalid guitar sound parameters.');
  // The low-pass reflection adds half a sample. An all-pass supplies the
  // remaining fraction, keeping fretted notes in tune at 44.1 and 48 kHz.
  const delay=sampleRate/frequency-.5,period=Math.floor(delay),fraction=delay-period,a=(1-fraction)/(1+fraction);
  const ring=new Float32Array(period),result=new Float32Array(Math.ceil(sampleRate*seconds));
  let mean=0;
  for(let i=0;i<period;i++){ring[i]=(random()*2-1)*.65+Math.sin(2*Math.PI*i/period)*.2;mean+=ring[i]/period}
  for(let i=0;i<period;i++)ring[i]-=mean;
  const loss=Math.exp(-6.91/(frequency*2.5));
  let last=0,previousInput=0,previousOutput=0,peak=0;
  for(let i=0;i<result.length;i++){
    const p=i%period,value=ring[p],filtered=.5*(value+last);last=value;
    const reflection=a*filtered+previousInput-a*previousOutput;previousInput=filtered;previousOutput=reflection;
    ring[p]=loss*reflection;
    const sample=value*Math.min(1,i/(sampleRate*.0015))*Math.min(1,(result.length-i)/(sampleRate*.08));
    result[i]=sample;peak=Math.max(peak,Math.abs(sample));
  }
  for(let i=0;i<result.length;i++)result[i]*=.75/Math.max(.1,peak);
  return result;
}
export function createGuitar(ctx,samples=null){
  const active=new Set(),strings=new Map(),buffers=new Map(),variants=new Map();
  const input=ctx.createGain(),highpass=ctx.createBiquadFilter(),body=ctx.createBiquadFilter(),warmth=ctx.createBiquadFilter(),compressor=ctx.createDynamicsCompressor();
  highpass.type='highpass';highpass.frequency.value=65;highpass.Q.value=.5;
  body.type='peaking';body.frequency.value=190;body.Q.value=.8;body.gain.value=2.5;
  warmth.type='lowpass';warmth.frequency.value=5600;warmth.Q.value=.5;
  compressor.threshold.value=-16;compressor.knee.value=12;compressor.ratio.value=3;compressor.attack.value=.003;compressor.release.value=.18;
  input.connect(highpass);highpass.connect(body);body.connect(warmth);warmth.connect(compressor);compressor.connect(ctx.destination);
  return {
    strum(time,chord,upstroke,options={}){
      const feel=Math.max(0,Math.min(1,options.feel??.4)),volume=Math.max(0,Math.min(1,options.volume??.75));
      let start=Math.max(ctx.currentTime+.002,time+(Math.random()-.5)*.008*feel);
      const spread=(upstroke?.007:.011)*(1+(Math.random()-.5)*.35*feel);
      for(const [index,{string,frequency}]of strumNotes(chord,upstroke).entries()){
        const pitch=frequency.toFixed(3),variant=(variants.get(pitch)||0)%3;variants.set(pitch,variant+1);const key=pitch+':'+variant;
        if(!samples&&!buffers.has(key)){
          const data=pluckedString(frequency,ctx.sampleRate),buffer=ctx.createBuffer(1,data.length,ctx.sampleRate);buffer.copyToChannel(data,0);
          if(buffers.size>=48)buffers.delete(buffers.keys().next().value);buffers.set(key,buffer);
        }
        // A new stroke damps the previous vibration of this physical string.
        const prior=strings.get(string);
        if(prior){prior.gain.gain.cancelScheduledValues(start);prior.gain.gain.setValueAtTime(prior.level,start);prior.gain.gain.exponentialRampToValueAtTime(.0001,start+.035);prior.source.stop(start+.04)}
        const source=ctx.createBufferSource(),gain=ctx.createGain(),pan=ctx.createStereoPanner?.();
        const level=.26*volume*(options.accent?1.3:1)*(upstroke?.7:1)*(upstroke&&index>3?.4:1)*(1+(Math.random()-.5)*.28*feel);
        source.buffer=samples?samples[string]:buffers.get(key);
        if(samples)source.playbackRate.setValueAtTime(frequency/openGuitar[string]*2**(-samplePitchOffsets[string]/1200),start);
        gain.gain.setValueAtTime(level,start);source.connect(gain);
        if(pan){pan.pan.value=(string-2.5)*.055;gain.connect(pan);pan.connect(input)}else gain.connect(input);
        const voice={source,gain,level};active.add(voice);strings.set(string,voice);
        source.onended=()=>{active.delete(voice);if(strings.get(string)===voice)strings.delete(string);source.disconnect();gain.disconnect();pan?.disconnect()};
        source.start(start);start+=spread*(1+(Math.random()-.5)*.2*feel);
      }
    },
    stop(){
      for(const {source,gain}of active){try{gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setTargetAtTime(.0001,ctx.currentTime,.004);source.stop(ctx.currentTime+.025)}catch{}}
      active.clear();strings.clear();
    },
  };
}
