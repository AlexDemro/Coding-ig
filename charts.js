// Image layout for recognized scores and photo OCR. ChordPro ([G]word) and
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
export function layoutChart(source,options={}){return layoutRows(parseChart(source),options)}
export function layoutRows(rows,{title='My chord sheet',artist='',columns=60,perPage=18}={}){
  if(!Number.isInteger(columns)||columns<12||!Number.isInteger(perPage)||perPage<1)throw new Error('Invalid page layout.');
  const wrapped=[];
  for(const original of rows){
    // Closely spaced note syllables can carry long chord names. Insert visual
    // spacing so chord labels never collide while keeping their syllable anchors.
    const row={...original,chords:[]},spaced=Array.from(original.lyrics);let shift=0,lastEnd=-2;
    for(const chord of [...original.chords].sort((a,b)=>a.column-b.column)){
      let column=chord.column+shift;const gap=Math.max(0,lastEnd+2-column);
      if(gap){spaced.splice(column,0,...new Array(gap).fill(' '));column+=gap;shift+=gap}
      row.chords.push({...chord,column});lastEnd=column+count(chord.text);
    }
    row.lyrics=spaced.join('');
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
// The PNG renderer supplies actual Inter font measurements. Keeping coordinates
// in one drawing plan aligns chords with proportional text without stretching it.
export function chartDrawing(page,total=1,measure=(text,{size})=>count(text)*size*.6){
  const elements=[],left=80,right=1160;
  const addText=(x,y,text,size=32,color='#233b31',weight=400)=>elements.push({type:'text',x,y,text,size,color,weight});
  const line=(y)=>elements.push({type:'line',x1:left,y1:y,x2:right,y2:y,color:'#dfe5d7'});
  const fitted=(text,size,weight)=>Math.min(size,(right-left)/Math.max(1,measure(text,{size,weight}))*size);
  elements.push({type:'rect',x:0,y:0,width:1240,height:1754,color:'#fffef9'});
  addText(left,70,'FRETMATE · PLAY SOMETHING YOU LOVE',15,'#7b8e70',600);
  const title=Array.from(page.title),titleLines=[title.slice(0,40).join(''),title.length>40?title.slice(40,79).join('')+(title.length>79?'…':''):''].filter(Boolean);
  titleLines.forEach((text,index)=>addText(left,138+index*54,text,fitted(text,48,700),'#233b31',700));
  const subtitle=page.artist.length>90?page.artist.slice(0,89)+'…':page.artist;
  addText(left,240,subtitle,fitted(subtitle,23,400),'#77856e');line(270);
  page.rows.forEach((row,index)=>{
    const y=320+index*73,chars=Array.from(row.lyrics),font={size:row.section?25:32,weight:row.section?600:400};
    const chunks=[],chords=[];let cursor=0,x=0,lastChordEnd=-16;
    for(const chord of [...row.chords].sort((a,b)=>a.column-b.column)){
      const prefix=chars.slice(cursor,chord.column).join('')+' '.repeat(Math.max(0,chord.column-Math.max(cursor,chars.length)));
      if(prefix)chunks.push({x,text:prefix});x+=measure(prefix,font);
      x=Math.max(x,lastChordEnd+16);chords.push({x,text:chord.text,uncertain:chord.uncertain});lastChordEnd=x+measure(chord.text,{size:32,weight:700});cursor=chord.column;
    }
    const tail=chars.slice(cursor).join('');if(tail)chunks.push({x,text:tail});
    const width=Math.max(x+measure(tail,font),lastChordEnd,0),scale=Math.min(1,(right-left)/Math.max(1,width));
    for(const chord of chords)addText(left+chord.x*scale,y,chord.text,32*scale,chord.uncertain?'#a67a31':'#46783c',700);
    for(const chunk of chunks)addText(left+chunk.x*scale,y+36,chunk.text,font.size*scale,row.section?'#7e8c71':'#233b31',font.weight);
  });
  line(1668);addText(left,1710,'YOUR PRACTICE. YOUR PACE.',15,'#7b8e70',500);addText(1060,1710,`${page.number} / ${total}`,18,'#7b8e70',500);
  return elements;
}
export function chartSummary(pages){return {chords:pages.reduce((sum,p)=>sum+p.rows.reduce((n,r)=>n+r.chords.length,0),0),lyrics:pages.some(p=>p.rows.some(r=>r.lyrics.trim()&&!r.section))}}
