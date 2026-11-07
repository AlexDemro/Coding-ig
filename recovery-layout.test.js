import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {readRecoveryLayout,recoverHarmonies,syllablesFromWord,buildRecoveredRows,agreeingWordConfidence} from './recovery-layout.js';
const archive=xml=>zipSync({'sheet#1/sheet#1.xml':strToU8(xml)});
function fixture(){
 let id=0;const systems=[];
 for(let si=0;si<2;si++){
  const top=100+si*400,bass=top+150,upper=si*2+1,lower=upper+1;
  const staff=(n,y)=>`<part><staff id="${n}" left="50" right="700"><lines>${Array.from({length:5},(_,j)=>`<line><point x="50" y="${y+j*10}"/></line>`).join('')}</lines></staff></part>`;
  let heads='';
  for(let col=0;col<6;col++){
   const positions=col<2?[[3,5],[0,-4]]:col<4?[[2,0],[4,0]]:[[1,-1],[3,-1]];
   for(let s=0;s<2;s++)for(const pitch of positions[s])heads+=`<head id="${++id}" staff="${s?lower:upper}" pitch="${pitch}" grade="0.9" shape="NOTEHEAD_BLACK"><bounds x="${100+col*100-5}" y="${(s?bass:top)+20+pitch*5-4}" w="10" h="8"/></head>`;
  }
  heads+=`<head staff="${upper}" pitch="12" grade="0.25" shape="NOTEHEAD_BLACK"><bounds x="104" y="180" w="10" h="8"/></head>`;
  systems.push(`<system id="${si+1}"><stack left="50" right="700" abnormal="true" expected="9/8" duration="15/8"/>${staff(upper,top)}${staff(lower,bass)}<sig><inters><clef staff="${upper}" kind="TREBLE"/><clef staff="${lower}" kind="BASS"/><key staff="${upper}" fifths="2" grade="0.9"/>${heads}</inters></sig></system>`);
 }
 return '<sheet>'+systems.join('')+'</sheet>';
}
const word=(text,x=100,gapAt=-1)=>{let p=x;const symbols=Array.from(text).map((text,i)=>{if(i===gapAt)p+=12;const box={x0:p,y0:0,x1:p+7,y1:20};p+=9;return {text,bbox:box}});return {text,confidence:95,bbox:{x0:x,y0:0,x1:p,y1:20},symbols}};
const line=(text,start=80,step=70)=>({confidence:90,words:text.split(' ').map((text,i)=>word(text,start+i*step))});
test('recovery uses strong notehead positions and key signatures without trusting broken durations',()=>{
 const result=recoverHarmonies(readRecoveryLayout(archive(fixture())));assert.equal(result.noteCount,48);assert.equal(result.measures,2);assert.deepEqual(result.pairs[0].bars[0].events.map(e=>e.chord),['D','D','G','G','A','A']);assert.equal(result.fifths,2);
});
test('uncertain noteheads, conflicting keys, or unmatched clefs cannot silently become a chart',()=>{
 assert.throws(()=>readRecoveryLayout(archive(fixture().replaceAll('grade="0.9" shape','grade="0.1" shape'))),e=>e.code==='UNRELIABLE_SCORE');
 assert.throws(()=>readRecoveryLayout(archive(fixture().replace('staff="3" fifths="2"','staff="3" fifths="-1"'))),/key signature/);
 assert.throws(()=>readRecoveryLayout(archive(fixture().replace('staff="2" kind="BASS"','staff="2" kind="TREBLE"'))),/staves/);
});
test('a later complete triad identifies an earlier root/fifth/seventh voicing in the same bar',()=>{
 const layout={pairs:[{top:{interline:10},bars:[{notes:[{x:100,staff:1,midi:62},{x:100,staff:2,midi:52},{x:100,staff:2,midi:59},{x:200,staff:1,midi:68}],events:[]}]}]};
 recoverHarmonies(layout);assert.deepEqual(layout.pairs[0].bars[0].events.map(e=>e.chord),['E7','E']);
});
test('two OCR passes increase confidence only for matching letters at the same position',()=>{
 const weak={...word('An'),confidence:20};assert.equal(agreeingWordConfidence(weak,[word('An')]),95);assert.equal(agreeingWordConfidence(weak,[word('As')]),20);assert.equal(agreeingWordConfidence(weak,[word('An',500)]),20);
});
test('printed syllable hyphens join words and actual glyph gaps restore merged OCR spaces',()=>{
 const parts=syllablesFromWord(word('as-sur-ance'));assert.deepEqual(parts.map(p=>p.text),['as','sur','ance']);assert.equal(parts[0].joinNext,true);assert.equal(parts[1].joinNext,true);
 assert.deepEqual(syllablesFromWord(word('Thisis',10,4)).map(p=>p.text),['This','is']);assert.equal(syllablesFromWord(word('Savior')).length,1);assert.deepEqual(syllablesFromWord(word('3.')),[]);assert.equal(syllablesFromWord(word('-'))[0].connect,true);
});
function grouped(){
 const layout=recoverHarmonies(readRecoveryLayout(archive(fixture())));layout.pairs[1].marker={x:350,name:'Chorus'};layout.pairs.push({...layout.pairs[1],marker:null});
 const systems=[
  [line('Warm hands make gentle music each day'),line('Another small melody is ready to play'),line('Keep a steady rhythm and sing along')],
  [line('Sing until the morning',80,55),{confidence:90,words:[...line('Take another breath',80,60).words,...line('Shared refrain begins',400,70).words]},line('Keep the rhythm flowing',80,55)],
  [line('Let this chorus carry on today')],
 ];return {layout,systems};
}
test('verse continuations and a chorus sharing a lyric line remain in the right sections',()=>{
 const {layout,systems}=grouped(),chart=buildRecoveredRows(layout,systems);
 assert.deepEqual(chart.rows.filter(r=>r.section).map(r=>r.lyrics),['Verse 1','Verse 2','Verse 3','Chorus']);
 const chorus=chart.rows.findIndex(r=>r.lyrics==='Chorus');assert.equal(chart.rows[chorus+1].lyrics,'Shared refrain begins');assert.equal(chart.rows[chorus+2].lyrics,'Let this chorus carry on today');
 assert.ok(chart.rows.some(r=>r.lyrics==='Take another breath'));assert.equal(chart.recoveryMode,'note-positions');
});
test('missing note evidence is marked with a question rather than an invented chord',()=>{
 const {layout,systems}=grouped();layout.pairs[2].bars.push({left:701,right:900,events:[]});systems[2][0].words.push(word('unclear',760));
 const chart=buildRecoveredRows(layout,systems);assert.equal(chart.uncertainChords,1);assert.ok(chart.rows.some(r=>r.chords.some(c=>c.text==='?'&&c.uncertain)));
});
test('missing verse lines still block an incomplete recovery',()=>{
 const {layout,systems}=grouped();layout.pairs[1].marker=null;systems[1]=systems[1].slice(0,2);assert.throws(()=>buildRecoveredRows(layout,systems),/verse lines are missing/);
});
