import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStrumming,presetSteps,resizeSteps,stepDuration,stepLabel} from './strumming.js';
import {pluckedString} from './guitar-audio.js';
test('saved edits survive normalization and invalid storage cannot create unsafe settings',()=>{
 const state=normalizeStrumming({custom:true,steps:[{stroke:'up',accent:true},{stroke:'rest',accent:true}],tempo:999,swing:-10,chord:'arbitrary',volume:999});
 assert.deepEqual(state.steps[0],{stroke:'up',accent:true});assert.deepEqual(state.steps[1],{stroke:'rest',accent:false});assert.equal(state.tempo,200);assert.equal(state.swing,50);assert.equal(state.volume,100);assert.equal(state.chord,'G');assert.deepEqual(normalizeStrumming(JSON.parse(JSON.stringify(state))),state);assert.equal(normalizeStrumming(null).steps.length,8);
});
test('doubling the grid preserves existing beat positions and accents',()=>{
 const steps=presetSteps(1),expanded=resizeSteps(steps,4);assert.equal(expanded.length,16);assert.deepEqual(expanded.filter((_,i)=>i%2===0),steps);assert.ok(expanded.filter((_,i)=>i%2).every(s=>s.stroke==='rest'));assert.deepEqual(resizeSteps(expanded,2),steps);assert.deepEqual(Array.from({length:4},(_,i)=>stepLabel(i,4)),['1','e','&','a']);
});
test('swing changes the groove while preserving a four-beat bar at every tempo',()=>{
 for(const subdivision of [2,4])for(const tempo of [30,80,200])for(const swing of [50,60,70]){
  const times=Array.from({length:4*subdivision},(_,i)=>stepDuration(i,tempo,subdivision,swing));assert.ok(times.every(t=>t>0));assert.ok(Math.abs(times.reduce((a,b)=>a+b)-4*60/tempo)<1e-10);assert.ok(times[0]>=times[1]);
 }
});
test('fractional string tuning keeps sustained fundamentals accurate at common sample rates',()=>{
 let seed=42;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
 for(const rate of [44100,48000])for(const hz of [82.4069,110,146.8324,195.9977,246.9417,329.6276,392]){
  const data=pluckedString(hz,rate,.4,random),segment=data.subarray(Math.floor(.15*rate),Math.floor(.35*rate));
  // Compare spectral energy around the expected fundamental, without asking a
  // microphone noise gate to analyze a synthetic individual string.
  const energy=f=>{let re=0,im=0;for(let i=0;i<segment.length;i++){const phase=2*Math.PI*f*i/rate,w=.5-.5*Math.cos(2*Math.PI*i/(segment.length-1));re+=segment[i]*w*Math.cos(phase);im+=segment[i]*w*Math.sin(phase)}return re*re+im*im};
  let best={energy:-1,cents:0};for(let cents=-20;cents<=20;cents++){const e=energy(hz*2**(cents/1200));if(e>best.energy)best={energy:e,cents}}
  assert.ok(Math.abs(best.cents)<=3,`${rate} Hz / ${hz} string was ${best.cents} cents off`);assert.ok(data.every(n=>Number.isFinite(n)&&Math.abs(n)<=.751));
 }
});
