import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {readRecognitionQuality,assertScoreQuality} from './score-quality.js';
const archive=body=>zipSync({'sheet#1/sheet#1.xml':strToU8('<sheet>'+body+'</sheet>')});
const score=()=>({measures:Array.from({length:10},()=>({})),lyrics:[]});
test('native recognition diagnostics retain abnormal measures and weak lyric grades',()=>{
 const result=readRecognitionQuality(archive('<measure abnormal="true"/><measure/><head grade="0.2"/><lyric-item kind="Syllable" grade="0.5"/><lyric-item kind="Hyphen" grade="0.1"/>'));
 assert.deepEqual(result,{measures:2,abnormalMeasures:1,heads:1,weakHeads:1,syllables:1,weakSyllables:1});assert.throws(()=>readRecognitionQuality(archive('<bad>')),e=>e.code==='UNRELIABLE_SCORE');
});
test('unreliable note timing is an explicit error, without exportable arrangement rows',()=>{
 const s=score();s.measures[2].timingMismatch=true;s.measures[5].timingMismatch=true;assert.throws(()=>assertScoreQuality(s),e=>e.code==='UNRELIABLE_SCORE');
 assert.throws(()=>assertScoreQuality(score(),{measures:20,abnormalMeasures:7}),e=>e.code==='UNRELIABLE_SCORE');assert.doesNotThrow(()=>assertScoreQuality(score(),{measures:20,abnormalMeasures:1}));
});
test('missing or low-confidence lyrics cannot be presented as a complete lyric sheet',()=>{
 const s=score();assert.throws(()=>assertScoreQuality(s,{syllables:25,weakSyllables:0}),/found lyrics/);
 s.lyrics=Array.from({length:10},(_,i)=>({part:0,voice:1,verse:1,time:i,syllabic:'single',text:'sing'}));assert.throws(()=>assertScoreQuality(s,{syllables:10,weakSyllables:3}),/unclear/);assert.doesNotThrow(()=>assertScoreQuality(s,{syllables:10,weakSyllables:0}));
});
test('broken syllable sequences are rejected while properly joined words are retained',()=>{
 const s=score();s.lyrics=Array.from({length:9},(_,i)=>({part:0,voice:1,verse:1,time:i,text:'word',syllabic:'begin'}));assert.throws(()=>assertScoreQuality(s),/don’t join/);
 for(let i=0;i<s.lyrics.length;i++)s.lyrics[i].syllabic=['begin','middle','end'][i%3];assert.doesNotThrow(()=>assertScoreQuality(s));
});
