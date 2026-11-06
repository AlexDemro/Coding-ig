import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rowsFromOCR} from './sheet-reader.js';
const word=(text,x,y,confidence=95)=>({text,confidence,bbox:{x0:x,x1:x+text.length*12,y0:y,y1:y+20}});
test('photo word positions align chords to the right lyric words, not OCR spacing guesses',()=>{
 const rows=rowsFromOCR({lines:[{words:[word('G',10,10),word('C',210,10)]},{words:[word('Walk',10,45),word('in',120,45),word('sunshine',210,45)]}]});
 assert.deepEqual(rows,[{lyrics:'Walk in sunshine',chords:[{text:'G',column:0},{text:'C',column:8}]}]);
});
test('nested OCR block geometry and text-only OCR responses both produce printable rows',()=>{
 const lines=[{words:[word('Am',0,0)]},{words:[word('An',0,30),word('original',40,30),word('line',180,30)]}];
 assert.equal(rowsFromOCR({blocks:[{paragraphs:[{lines}]}]})[0].chords[0].text,'Am');
 assert.equal(rowsFromOCR({text:'G     C\nAn original line'})[0].lyrics,'An original line');
});
test('lyrics alone, chords alone, staff-like symbols and empty responses never invent a chart',()=>{
 for(const data of [{text:''},{text:'G C Am'},{text:'Only words without chords'},{text:'G\n♪ ♫ | —'},{text:'G\nA I'}])assert.throws(()=>rowsFromOCR(data),/couldn’t find/);
});
test('low confidence chord guesses and unrelated distant text are rejected',()=>{
 for(const data of [{lines:[{words:[word('G',0,0,20)]},{words:[word('Actual',0,30),word('lyrics',150,30)]}]},{lines:[{words:[word('G',0,0)]},{words:[word('Distant',0,1000),word('text',150,1000)]}]}])assert.throws(()=>rowsFromOCR(data),/couldn’t find/);
});
