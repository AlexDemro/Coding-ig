import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analysePitch,GuitarTuner,microphoneConstraints} from './tuner.js';
function random(seed=1234567){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1}}
function note(hz,rate,{amplitude=.0002,noise=0,harmonics=[1,.5,.25,.1],offset=0,decay=0}={}){
 const rand=random();
 return Float32Array.from({length:8192},(_,i)=>{
  const t=(i+offset)/rate;
  return amplitude*Math.exp(-decay*t)*harmonics.reduce((sum,h,n)=>sum+h*Math.sin(2*Math.PI*hz*(n+1)*t),0)+noise*rand();
 });
}
function accurate(actual,expected,tolerance=4){assert.ok(actual&&Math.abs(1200*Math.log2(actual/expected))<tolerance,`expected ${expected}Hz, got ${actual}Hz`)}
const tunings=[55,61.7354,65.4064,73.4162,77.7817,82.4069,110,146.8324,195.9977,246.9417,329.6276,440,659.255];
test('YIN detects quiet plucked guitar harmonics across alternate tunings at 44.1, 48 and 96 kHz',()=>{
 for(const rate of [44100,48000,96000])for(const hz of tunings){accurate(analysePitch(note(hz,rate,{decay:2,noise:.000005}),rate).hz,hz)}
});
test('YIN resolves stronger second harmonics without an octave jump',()=>{
 for(const hz of [73.4162,82.4069,110,146.8324,329.6276])accurate(analysePitch(note(hz,48000,{harmonics:[.23,1,.12,.15]}),48000).hz,hz);
});
test('YIN remains accurate with quiet notes mixed with broadband noise',()=>{
 for(const hz of [82.4069,110,146.8324,195.9977,246.9417,329.6276])accurate(analysePitch(note(hz,48000,{amplitude:.0003,noise:.00015}),48000).hz,hz,6);
});
test('silence, DC, random broadband noise and isolated transients produce no notes',()=>{
 const rand=random();
 for(const amplitude of [.00003,.0003,.02,.4])for(let trial=0;trial<12;trial++){
  const noise=Float32Array.from({length:8192},()=>rand()*amplitude);
  assert.equal(analysePitch(noise,48000).hz,null);
 }
 for(const signal of [new Float32Array(8192),new Float32Array(8192).fill(.2),Float32Array.from({length:8192},(_,i)=>i===400?.5:0)])assert.equal(analysePitch(signal,48000).hz,null);
});
test('adaptive noise floor learns a room then accepts a quiet string above it',()=>{
 const tuner=new GuitarTuner(),rand=random();
 for(let frame=0;frame<20;frame++){
  const result=tuner.process(Float32Array.from({length:8192},()=>rand()*.0001),48000,frame*80);
  assert.equal(result.hz,null);assert.equal(result.sensitivity,1);
 }
 assert.ok(tuner.noiseFloor>.00003);
 let reading;
 for(let frame=20;frame<27;frame++)reading=tuner.process(note(82.4069,48000,{noise:.0001}),48000,frame*80);
 accurate(reading.hz,82.4069,6);assert.ok(reading.sensitivity>1);assert.ok(reading.sensitivity<=64);
});
test('stable tracking rejects an isolated octave and reacquires a real string change',()=>{
 const tuner=new GuitarTuner();let reading;
 for(let i=0;i<8;i++)reading=tuner.process(note(110*2**((i%2?2:-2)/1200),48000),48000,i*80);
 accurate(reading.hz,110,3);
 assert.equal(tuner.process(note(220,48000),48000,640).hz,null);
 for(let i=9;i<13;i++)reading=tuner.process(note(146.8324,48000),48000,i*80);
 accurate(reading.hz,146.8324);
 reading=tuner.process(new Float32Array(8192),48000,1500);
 assert.equal(reading.hz,null);assert.equal(reading.status,'weak');assert.equal(tuner.smoothed,null);
});
test('decaying quiet string stays detectable without learning it as room noise',()=>{
 const tuner=new GuitarTuner();let reading;
 for(let frame=0;frame<20;frame++)reading=tuner.process(note(82.4069,48000,{amplitude:.001*Math.exp(-frame/6),noise:.000002}),48000,frame*80);
 accurate(reading.hz,82.4069);assert.ok(tuner.noiseFloor<.00001);
});
test('too-weak, noisy and unsettled readings provide explicit states and finite meter levels',()=>{
 const tuner=new GuitarTuner();
 for(const signal of [new Float32Array(8192),note(110,48000,{amplitude:.000001}),note(110,48000)]){
  const r=tuner.process(signal,48000);assert.ok(Number.isFinite(r.db));assert.ok(r.level>=0&&r.level<=1);assert.equal(r.hz,null);
 }
 assert.equal(tuner.process(note(110,48000),48000).status,'settling');
});
test('capture requests disable supported speech processing without requiring constraints',()=>{
 assert.deepEqual(microphoneConstraints({getSupportedConstraints:()=>({echoCancellation:true,noiseSuppression:true,autoGainControl:false})}),{audio:{echoCancellation:{ideal:false},noiseSuppression:{ideal:false}}});
 assert.deepEqual(microphoneConstraints({}).audio.autoGainControl,{ideal:false});
});

test('low-pass room rumble and very poor signal-to-noise ratios do not lock a note',()=>{
 const rand=random(989),tuner=new GuitarTuner();let filtered=0;
 for(let frame=0;frame<25;frame++){
  const samples=Float32Array.from({length:8192},()=>{filtered=.94*filtered+.06*rand();return filtered*.01});
  assert.equal(tuner.process(samples,48000,frame*80).hz,null);
 }
 const buried=note(110,48000,{amplitude:.00001,noise:.002});
 assert.equal(tuner.process(buried,48000,2200).hz,null);
});

test('quiet pitch detection is independent of microphone amplitude and DC offset',()=>{
 for(const amplitude of [.00003,.0001,.001,.1]){
  const samples=note(195.9977,44100,{amplitude});
  for(let i=0;i<samples.length;i++)samples[i]+=.01;
  accurate(analysePitch(samples,44100).hz,195.9977);
 }
});
