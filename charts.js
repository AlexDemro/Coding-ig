// Shared image layout for pasted songs and OCR. ChordPro ([G]word) and
// traditional chord-above-lyric lines are both accepted; no chords are invented.
const chordPattern=/^[A-G](?:#|b)?(?:(?:maj|min|m|sus|dim|aug|add)?\d*)?(?:\/[A-G](?:#|b)?)?$/;
export function isChord(text){return chordPattern.test(text)}
const count=text=>Array.from(text).length;
export function parseChart(source){
  if(source.length>40000)throw new Error('Please use at most 40,000 characters per chart.');
  const rows=[];let pending=null;
  const flush=()=>{if(pending){rows.push({lyrics:'',chords:pending});pending=null}};
  for(const raw of source.replace(/\r\n?/g,'\n').split('\n')){
    const line=raw.replace(/\t/g,'    ');
    if(!line.trim()){flush();rows.push({lyrics:'',chords:[]});continue}
    // Section headings are kept as text, rather than treated as chord symbols.
    if(/^\[(?:verse|chorus|bridge|intro|outro|pre-chorus|instrumental).*\]$/i.test(line.trim())){flush();rows.push({lyrics:line.trim(),chords:[],section:true});continue}
    if(/\[([^\]]+)\]/.test(line)&&[...line.matchAll(/\[([^\]]+)\]/g)].some(m=>isChord(m[1]))){
      flush();let lyrics='',cursor=0;const chords=[];
      for(const match of line.matchAll(/\[([^\]]+)\]/g)){
        if(!isChord(match[1]))continue;
        lyrics+=line.slice(cursor,match.index);chords.push({column:count(lyrics),text:match[1]});cursor=match.index+match[0].length;
      }
      lyrics+=line.slice(cursor);rows.push({lyrics,chords});continue;
    }
    const tokens=[...line.matchAll(/\S+/g)].filter(m=>!/^\|+$/.test(m[0]));
    if(tokens.length&&tokens.every(m=>isChord(m[0]))){
      flush();pending=tokens.map(m=>({column:count(line.slice(0,m.index)),text:m[0]}));continue;
    }
    rows.push({lyrics:line,chords:pending||[]});pending=null;
  }
  flush();return rows;
}
export function layoutChart(source,{title='My chord sheet',artist='',columns=60,perPage=18}={}){
  if(!Number.isInteger(columns)||columns<12||!Number.isInteger(perPage)||perPage<1)throw new Error('Invalid page layout.');
  const rows=parseChart(source);const wrapped=[];
  for(const row of rows){
    const chars=Array.from(row.lyrics),end=Math.max(chars.length,...row.chords.map(c=>c.column+count(c.text)),0);
    if(end===0){wrapped.push(row);continue}
    let start=0;
    while(start<end){
      let stop=Math.min(end,start+columns);
      if(stop<chars.length){const lastSpace=chars.slice(start,stop).lastIndexOf(' ');if(lastSpace>columns*.55)stop=start+lastSpace+1}
      // Do not split a chord label over the edge of the page.
      const crossing=row.chords.find(c=>c.column>start&&c.column<stop&&c.column+count(c.text)>stop);
      if(crossing)stop=crossing.column;
      wrapped.push({...row,lyrics:chars.slice(start,stop).join(''),chords:row.chords.filter(c=>c.column>=start&&c.column<stop).map(c=>({...c,column:c.column-start}))});
      start=stop;
    }
  }
  const pages=[];
  for(let i=0;i<wrapped.length;i+=perPage)pages.push({title:title.trim()||'My chord sheet',artist:artist.trim(),rows:wrapped.slice(i,i+perPage),number:pages.length+1});
  return pages;
}
const escape=value=>String(value).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
function titleLines(value,max=42){const chars=Array.from(value);return [chars.slice(0,max).join(''),chars.length>max?chars.slice(max,max*2-1).join('')+(chars.length>=max*2?'…':''):''].filter(Boolean)}
export function chartSVG(page,total=1){
  const text=(x,y,value,size=28,color='#233b31',extra='')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${escape(value)}</text>`;
  let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1754" viewBox="0 0 1240 1754" role="img"><title>'+escape(page.title)+'</title><rect width="1240" height="1754" fill="#fffef9"/><g font-family="Arial, sans-serif">';
  svg+=text(80,70,'FRETMATE · PLAY SOMETHING YOU LOVE',16,'#7b8e70','letter-spacing="2"');
  titleLines(page.title).forEach((line,i)=>svg+=text(80,135+i*48,line,42,'#233b31','font-weight="700"'));
  svg+=text(80,240,page.artist.length>75?page.artist.slice(0,74)+'…':page.artist,23,'#77856e');
  svg+='<path d="M80 270H1160" stroke="#dfe5d7"/></g><g font-family="monospace" xml:space="preserve">';
  page.rows.forEach((row,i)=>{
    const y=320+i*73;
    for(const chord of row.chords)svg+=text(80+chord.column*18.1,y,chord.text,28,'#46783c','font-weight="700" textLength="'+count(chord.text)*18.1+'" lengthAdjust="spacingAndGlyphs"');
    svg+=text(80,y+34,row.lyrics,28,row.section?'#7e8c71':'#233b31',(row.section?'font-weight="700" ':'')+(row.lyrics?'textLength="'+count(row.lyrics)*18.1+'" lengthAdjust="spacingAndGlyphs"':''));
  });
  svg+='</g><path d="M80 1668H1160" stroke="#dfe5d7"/><g font-family="Arial, sans-serif">'+text(80,1710,'YOUR PRACTICE. YOUR PACE.',16,'#7b8e70')+text(1060,1710,`${page.number} / ${total}`,18,'#7b8e70')+'</g></svg>';
  return svg;
}
export function chartSummary(pages){return {chords:pages.reduce((sum,p)=>sum+p.rows.reduce((n,r)=>n+r.chords.length,0),0),lyrics:pages.some(p=>p.rows.some(r=>r.lyrics.trim()&&!r.section))}}
