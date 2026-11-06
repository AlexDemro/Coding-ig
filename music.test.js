import {test} from 'node:test';import assert from 'node:assert/strict';import {transpose,extractChords,detectPitch} from './music.js';
test('capo conversion transposes roots and bass notes in both directions',()=>{assert.equal(transpose('D/F#',2),'E/G#');assert.equal(transpose('Bbmaj7',-3),'Gmaj7');assert.equal(transpose('Am',12),'Am');assert.equal(transpose('C',-1),'B')});
test('chord extraction accepts symbols and rejects ordinary words',()=>assert.deepEqual(extractChords('Intro: | Am F C G7 | D/F# hello Amplitude'),['Am','F','C','G7','D/F#']));
test('tuner recognizes standard string frequencies and silence',()=>{const rate=48000;for(const hz of [82.41,110,146.83,196,246.94,329.63,440]){const input=Float32Array.from({length:4096},(_,i)=>.3*Math.sin(2*Math.PI*hz*i/rate));const pitch=detectPitch(input,rate);assert.ok(pitch&&Math.abs(1200*Math.log2(pitch/hz))<20,`${hz} detected as ${pitch}`)}assert.equal(detectPitch(new Float32Array(4096),rate),null)});

import {strumNotes,pluckedString,createGuitar} from './guitar-audio.js';
test('strums sweep playable chord strings in the correct direction',()=>{
 assert.deepEqual(strumNotes('D').map(n=>n.string),[2,3,4,5]);
 assert.deepEqual(strumNotes('D',true).map(n=>n.string),[5,4,3,2]);
 assert.ok(Math.abs(strumNotes('G')[0].frequency-97.9989)<.01);
});
test('plucked strings produce finite audio with a decaying tail',()=>{
 const samples=pluckedString(110,48000);
 assert.equal(samples.length,81600);
 assert.ok(samples.every(Number.isFinite));
 const energy=s=>s.reduce((sum,x)=>sum+x*x,0)/s.length;
 assert.ok(energy(samples.slice(100,4900))>.001);
 assert.ok(energy(samples.slice(-4800))<energy(samples.slice(100,4900))*.1);
});
test('guitar playback staggers string attacks and stops active notes',()=>{
 const sources=[];
 const ctx={sampleRate:48000,destination:{},createBuffer:()=>({copyToChannel(){}}),createGain:()=>({gain:{},connect(){},disconnect(){}}),createBufferSource(){const source={connect(){},disconnect(){},start(t){this.time=t},stop(){this.stopped=true}};sources.push(source);return source}};
 const guitar=createGuitar(ctx);guitar.strum(1,'D',false);
 assert.equal(sources.length,4);
 assert.deepEqual(sources.map(s=>s.time),[1,1.014,1.028,1.042]);
 guitar.stop();assert.ok(sources.every(s=>s.stopped));
});

test('tuner responds immediately, resumes audio before permission, handles denial and cancellation, and connects live input',async()=>{
 const elements=new Map();
 const defaults={'chord-search':'','chord-family':'all','capo-input':'G D Em C','capo-fret':'0','capo-mode':'1',beats:'4',pattern:'0'};
 function element(id){if(!elements.has(id))elements.set(id,{value:defaults[id]??'',textContent:'',style:{},classList:{remove(){},toggle(){}},setAttribute(){},add(){},addEventListener(){},replaceChildren(){}});return elements.get(id)}
 const old={document:globalThis.document,window:globalThis.window,Option:globalThis.Option,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
 const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const calls=[];let request,animation;
 const stringButton={dataset:{string:'40'},classList:{toggle(){}},setAttribute(){}};
 const graphNode=()=>({connect(){calls.push('connect')},disconnect(){}});
 const ctx={state:'suspended',sampleRate:48000,destination:{},resume(){calls.push('resume');this.state='running';return Promise.resolve()},createMediaStreamSource(){calls.push('source');return graphNode()},createAnalyser(){return {...graphNode(),getFloatTimeDomainData(samples){for(let i=0;i<samples.length;i++)samples[i]=.0002*Math.sin(2*Math.PI*110*i/48000)}}},createGain(){return {...graphNode(),gain:{value:1}}}};
 globalThis.document={getElementById:element,querySelectorAll:selector=>selector==='[data-string]'?[stringButton]:[],createElement:()=>({}),addEventListener(){}};
 globalThis.window={isSecureContext:true,AudioContext:class{constructor(){return ctx}}};
 globalThis.Option=class{};globalThis.requestAnimationFrame=callback=>{animation=callback;return 1};globalThis.cancelAnimationFrame=()=>{};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia(){calls.push('permission');return new Promise((resolve,reject)=>{request={resolve,reject}})}}}});
 try{
  await import('./app.js');
  let pending=element('mic').onclick();
  assert.match(element('tune-status').textContent,/Waiting/);
  assert.deepEqual(calls.slice(0,2),['resume','permission']);
  request.reject(Object.assign(new Error(),{name:'NotAllowedError'}));await pending;
  assert.match(element('tune-status').textContent,/blocked/);
  pending=element('mic').onclick();await element('mic').onclick();
  let stopped=0;const stream={getTracks:()=>[{stop(){stopped++}}]};request.resolve(stream);await pending;
  assert.equal(stopped,1);
  pending=element('mic').onclick();request.resolve(stream);await pending;
  assert.equal(element('mic').textContent,'Stop listening');assert.ok(calls.includes('source'));
  for(const time of [80,160,240,320])animation(time);
  assert.equal(element('pitch-note').textContent,'A2');assert.ok(element('input-level').value>0);assert.match(element('input-level-text').textContent,/Note detected/);
  stringButton.onclick();for(const time of [400,480,560])animation(time);
  assert.equal(element('pitch-note').textContent,'E2');assert.match(element('tune-status').textContent,/Loosen/);
  await element('mic').onclick();assert.equal(stopped,2);
  window.isSecureContext=false;await element('mic').onclick();assert.match(element('tune-status').textContent,/HTTPS or localhost/);
  window.isSecureContext=true;window.webkitAudioContext=window.AudioContext;delete window.AudioContext;
  await import('./app.js?safari-fallback');
  pending=element('mic').onclick();request.resolve(stream);await pending;
  for(const time of [80,160,240,320])animation(time);
  assert.equal(element('pitch-note').textContent,'A2');await element('mic').onclick();
 }finally{
  for(const [key,value] of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}
  if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else delete globalThis.navigator;
 }
});
