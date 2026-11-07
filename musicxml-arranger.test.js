import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {readMusicXML,arrangeChords,scoreToChart} from './musicxml-arranger.js';
const note=(step,octave=4,extra='')=>`<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>4</duration>${extra}</note>`;
const lyric=(word,number=1,syllabic='single')=>`<lyric number="${number}"><syllabic>${syllabic}</syllabic><text>${word}</text></lyric>`;
const xml=body=>`<?xml version="1.0"?><score-partwise><work><work-title>Original test score</work-title></work><part id="P1"><measure number="1"><attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>${body}</measure></part></score-partwise>`;
test('reads real pitches, accidentals, durations and backup/chord timing from MusicXML',()=>{
 const source=xml(note('C')+note('E',4,'<chord/>')+'<backup><duration>4</duration></backup>'+note('G',3));
 const result=readMusicXML(source);assert.deepEqual(result.notes.map(x=>[x.midi,x.time,x.duration]),[[60,0,1],[64,0,1],[55,0,1]]);assert.equal(result.measures[0].length,1);
});
test('a sustained C major stack produces a C accompaniment without requiring chord text',()=>{
 const source=xml(note('C',3)+note('E',4,'<chord/>')+note('G',4,'<chord/>'));
 const frames=arrangeChords(readMusicXML(source));assert.equal(frames[0].chord,'C');
});
test('lyrics come from note syllables and generated chords are aligned above them',()=>{
 const result=scoreToChart(xml(note('C',4,lyric('Sing'))+note('E',4,lyric('this'))+note('G',4,lyric('melody'))));
 assert.equal(result.lyrical,true);assert.ok(result.rows.some(r=>r.lyrics==='Sing this melody'&&r.chords.length));assert.match(result.subtitle,/Suggested/);
});
test('joins syllables, preserves verses and never invents lyrics for instrumentals',()=>{
 const result=scoreToChart(xml(note('C',4,lyric('Bless',1,'begin'))+note('E',4,lyric('ed',1,'end'))+note('G',4,lyric('assurance'))));
 assert.ok(result.rows.some(r=>r.lyrics==='Blessed assurance'));
 const instrumental=scoreToChart(xml(note('C')+note('E')+note('G')));assert.equal(instrumental.lyrical,false);assert.match(instrumental.subtitle,/no lyrics/);assert.ok(instrumental.rows.some(r=>r.lyrics==='Measure 1'));assert.ok(instrumental.warnings.length);
});
test('reads standard compressed MXL and rejects XML entities or empty notation',()=>{
 const content=xml(note('C')+note('E')+note('G'));
 assert.equal(readMusicXML(zipSync({'score.xml':strToU8(content),'META-INF/container.xml':strToU8('<container/>')})).notes.length,3);
 assert.throws(()=>readMusicXML('<!DOCTYPE score-partwise [<!ENTITY x "malicious">]>'+content),/unsupported/);
 assert.throws(()=>readMusicXML(xml('<note><rest/><duration>4</duration></note>')),/No musical notes/);
});
test('compound meter and ties retain time without double-advancing chord notes',()=>{
 const source=xml(note('C',4,'<tie type="start"/>')+note('E',4,'<chord/>')+note('C',4,'<tie type="stop"/>')).replace('<beats>4</beats><beat-type>4','<beats>9</beats><beat-type>8');
 const result=readMusicXML(source);assert.equal(result.measures[0].beats,9);assert.deepEqual(result.notes.map(n=>n.time),[0,0,1]);
});

test('missing part timing metadata uses shared divisions and aligns parts by measure labels',()=>{
 const source=xml(note('C')).replace('</part></score-partwise>','<measure number="2">'+note('D')+'</measure></part><part id="P2"><measure number="2">'+note('G',3)+'</measure></part></score-partwise>');
 const score=readMusicXML(source);const bass=score.notes.find(n=>n.part===1);assert.equal(bass.duration,1);assert.equal(bass.measure,1);assert.equal(bass.time,score.measures[1].start);assert.ok(score.recognitionWarnings.length);
});
test('printed harmony overrides guesses and retains slash chords and offbeat changes',()=>{
 const harmony=(root,kind,bass='')=>`<harmony><root><root-step>${root}</root-step></root><kind>${kind}</kind>${bass?'<bass><bass-step>'+bass+'</bass-step></bass>':''}</harmony>`;
 const source=xml(harmony('D','dominant','F')+note('C')+harmony('A','minor')+note('E')+note('G'));
 const result=scoreToChart(source),frames=arrangeChords(readMusicXML(source));assert.equal(result.chordSource,'printed');assert.deepEqual(frames.map(f=>f.chord),['D7/F','Am']);assert.equal(frames[1].time,1);
 const decorated=xml('<harmony><root><root-step>D</root-step><root-alter>-1</root-alter></root><kind>dominant</kind><degree><degree-value>9</degree-value><degree-alter>0</degree-alter><degree-type>add</degree-type></degree></harmony>'+note('C')+'<harmony><kind>none</kind></harmony>'+note('E'));
 assert.deepEqual(arrangeChords(readMusicXML(decorated)).map(f=>f.chord),['Db7add9','N.C.']);
});
test('multiple measures with mismatched durations are blocked before chord arrangement',()=>{
 const source=xml(note('C')).replace('</part></score-partwise>','<measure number="2">'+note('C')+'</measure><measure number="3">'+note('G')+'</measure></part></score-partwise>');
 assert.throws(()=>scoreToChart(source),e=>e.code==='UNRELIABLE_SCORE');
});
