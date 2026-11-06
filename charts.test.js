import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseChart,layoutChart,chartSVG,chartSummary} from './charts.js';
test('inline chord changes anchor above the intended lyric characters',()=>{
 assert.deepEqual(parseChart('[G]Hello [Am]there'),[{lyrics:'Hello there',chords:[{column:0,text:'G'},{column:6,text:'Am'}]}]);
});
test('traditional OCR chord lines preserve spaces and attach to the following lyrics',()=>{
 const rows=parseChart('Am      F\nWalk in the sun\n\n[Chorus]\nC    G\nSing again');
 assert.deepEqual(rows[0],{lyrics:'Walk in the sun',chords:[{column:0,text:'Am'},{column:8,text:'F'}]});
 assert.equal(rows[2].section,true);assert.equal(rows[3].chords[1].column,5);
});
test('lyrics and section headings are never invented or mistaken for chart metadata',()=>{
 const pages=layoutChart('Am G C');assert.equal(chartSummary(pages).lyrics,false);
 assert.equal(chartSummary(layoutChart('[Verse]\nJust words')).chords,0);
 assert.equal(parseChart('[Verse 2]')[0].lyrics,'[Verse 2]');
});
test('wrapping preserves every lyric character and chord through page boundaries',()=>{
 const input='[G]This is an original practice line with [C]lots of words to test how the chords follow their [D]words even when the line becomes very long.';
 const original=parseChart(input)[0],pages=layoutChart(input,{columns:24,perPage:2}),rows=pages.flatMap(p=>p.rows);
 assert.equal(rows.map(r=>r.lyrics).join(''),original.lyrics);assert.ok(pages.length>1);
 let offset=0;const chords=[];for(const row of rows){for(const c of row.chords){assert.ok(c.column+c.text.length<=24);chords.push({...c,column:c.column+offset})}offset+=Array.from(row.lyrics).length}
 assert.deepEqual(chords,original.chords);
});
test('a long chord at a wrap boundary moves intact to the next row',()=>{
 const rows=layoutChart('1234567890 [Cmaj7/G]hello',{columns:14}).flatMap(p=>p.rows);
 assert.equal(rows[1].chords[0].text,'Cmaj7/G');assert.equal(rows[1].chords[0].column,0);
});
test('image markup escapes user text and fixes glyph spacing for chord alignment',()=>{
 const pages=layoutChart('[G]<script>alert("x")</script> & sing',{title:'<unsafe> & "title"'});
 const svg=chartSVG(pages[0]);assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('&lt;script&gt;'));assert.ok(svg.includes('&amp;'));assert.ok(svg.includes('lengthAdjust="spacingAndGlyphs"'));assert.ok(svg.includes('width="1240" height="1754"'));
});
test('song size is bounded and multi-page output includes page numbering',()=>{
 assert.throws(()=>parseChart('a'.repeat(40001)),/40,000/);
 const pages=layoutChart(Array.from({length:40},()=> '[G]An original line').join('\n'));
 assert.equal(pages.length,3);assert.match(chartSVG(pages[2],3),/3 \/ 3/);
});

test('adjacent lyric syllables get enough spacing for long chord labels',()=>{
 const rows=layoutChart('[Bb]A[Gm7]ve [D]Ma[A7]ria').flatMap(page=>page.rows);
 for(const row of rows)for(let i=1;i<row.chords.length;i++)assert.ok(row.chords[i].column>=row.chords[i-1].column+row.chords[i-1].text.length+2);
 assert.match(rows.map(r=>r.lyrics).join(''),/A +ve/);
});
