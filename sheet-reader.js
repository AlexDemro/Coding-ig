import {isChord,parseChart} from './charts.js';
const clean=text=>String(text||'').replace(/^[|(),;]+|[|(),;]+$/g,'').trim();
const letters=text=>(text.match(/\p{L}{2,}/gu)||[]).length;
export function rowsFromOCR(data){
  let lines=data?.lines;
  if(!Array.isArray(lines))lines=data?.blocks?.flatMap(block=>block.paragraphs?.flatMap(paragraph=>paragraph.lines||[])||[]);
  let rows;
  if(Array.isArray(lines)&&lines.some(line=>line.words?.length)){
    rows=[];let pending=[];
    for(const line of lines){
      const words=(line.words||[]).filter(w=>w.text?.trim()&&w.bbox&&Number.isFinite(w.bbox.x0)).sort((a,b)=>a.bbox.x0-b.bbox.x0);
      if(!words.length)continue;
      const chordLine=words.every(w=>isChord(clean(w.text)));
      if(chordLine){pending=words.filter(w=>w.confidence===undefined||w.confidence>=45);continue}
      const text=words.map(w=>w.text.trim()).join(' ');
      if(letters(text)<2){pending=[];continue}
      let column=0;
      const anchors=words.map(w=>{const anchor={x:w.bbox.x0,column};column+=Array.from(w.text.trim()).length+1;return anchor});
      const chords=pending.filter(w=>{
        // A distant chord line must not attach to an unrelated paragraph.
        const height=Math.max(1,(w.bbox.y1||0)-(w.bbox.y0||0));
        return !Number.isFinite(words[0].bbox.y0)||!Number.isFinite(w.bbox.y1)||words[0].bbox.y0-w.bbox.y1<=height*6;
      }).map(w=>({text:clean(w.text),column:anchors.reduce((closest,a)=>Math.abs(a.x-w.bbox.x0)<Math.abs(closest.x-w.bbox.x0)?a:closest).column}));
      rows.push({lyrics:text,chords});pending=[];
    }
  }else rows=parseChart(String(data?.text||''));
  // Do not produce a pretend chord/lyric image from staff symbols, a chord-only
  // photo, lyrics alone, or an OCR response containing no usable content.
  if(!rows.some(row=>row.chords.length&&letters(row.lyrics)>=2))throw new Error('I couldn’t find printed lyrics with chord names above them. Try a clear, close-up photo showing both. Staff notes alone need a music-recognition service.');
  return rows;
}
