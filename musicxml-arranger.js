import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {unzipSync} from 'fflate';
const mod=n=>(n%12+12)%12;
const pitchClasses={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const sharpNames=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const flatNames=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
function tree(raw){
 return raw.flatMap(entry=>Object.entries(entry).filter(([name])=>name!==':@'&&name!=='#text'&&!name.startsWith('?')).map(([name,children])=>({name,attributes:entry[':@']||{},children:Array.isArray(children)?tree(children):[],text:Array.isArray(children)?children.filter(x=>'#text'in x).map(x=>String(x['#text'])).join(''):String(children??'')})));
}
const child=(node,name)=>node?.children.find(x=>x.name===name);
const children=(node,name)=>node?.children.filter(x=>x.name===name)||[];
const text=node=>node?node.text+node.children.map(text).join(''):'';
const value=(node,name)=>text(child(node,name));
const num=(node,name,fallback=0)=>{const n=Number(value(node,name));return Number.isFinite(n)&&value(node,name)!==''?n:fallback};
export function readMusicXML(input){
 let xml;
 if(typeof input==='string')xml=input;
 else if(input[0]===0x50&&input[1]===0x4b){
  let bytes=0;
  const archive=unzipSync(input,{filter:entry=>{
   if(entry.originalSize>8*1024*1024)throw new Error('The recognized score is too large.');
   bytes+=entry.originalSize;if(bytes>20*1024*1024)throw new Error('The recognized score is too large.');
   return /\.(?:xml|musicxml)$/i.test(entry.name)&&!entry.name.startsWith('META-INF/');
  }});
  const score=Object.entries(archive).find(([,data])=>new TextDecoder().decode(data.subarray(0,2000)).includes('<score-partwise'));
  if(!score)throw new Error('No readable notation was exported from the photo.');xml=new TextDecoder().decode(score[1]);
 }else xml=new TextDecoder().decode(input);
 if(xml.length>8*1024*1024||/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(xml))throw new Error('The recognized score format is unsupported.');
 xml=xml.replace(/<!DOCTYPE[^>]*>/gi,'');
 if(XMLValidator.validate(xml)!==true)throw new Error('The notation engine returned invalid MusicXML.');
 const root=tree(new XMLParser({preserveOrder:true,ignoreAttributes:false,trimValues:false,parseTagValue:false}).parse(xml)).find(x=>x.name==='score-partwise');
 if(!root)throw new Error('Only partwise MusicXML scores are supported.');
 const measures=[],notes=[],lyrics=[],recognitionWarnings=[],measureIndices=new Map();
 const parts=children(root,'part');
 const defaultDivisions=parts.flatMap(part=>children(part,'measure')).map(m=>num(child(m,'attributes'),'divisions')).find(n=>n>0)||1;
 for(const [partIndex,part]of parts.entries()){
  let divisions=defaultDivisions,beats=4,beatType=4,fifths=0,mode='major',ownDivisions=false;
  const occurrences=new Map();
  for(const [order,measure]of children(part,'measure').entries()){
   const label=measure.attributes['@_number']||String(order+1),occurrence=occurrences.get(label)||0;occurrences.set(label,occurrence+1);
   const key=label+'#'+occurrence;if(!measureIndices.has(key))measureIndices.set(key,measureIndices.size);const index=measureIndices.get(key);
   let cursor=0,previousStart=0,end=0;
   if(!measures[index])measures[index]={index,number:measure.attributes['@_number']||String(index+1),length:0,beats,beatType,fifths,mode,implicit:measure.attributes['@_implicit']==='yes'};
   for(const item of measure.children){
    if(item.name==='attributes'){
     if(child(item,'divisions'))ownDivisions=true;divisions=Math.max(1,num(item,'divisions',divisions));
     const time=child(item,'time');if(time){beats=num(time,'beats',beats);beatType=num(time,'beat-type',beatType)}
     const key=child(item,'key');if(key){fifths=num(key,'fifths',fifths);mode=value(key,'mode')||mode}
    }else if(item.name==='backup')cursor=Math.max(0,cursor-num(item,'duration')/divisions);
    else if(item.name==='forward'){cursor+=num(item,'duration')/divisions;end=Math.max(end,cursor)}
    else if(item.name==='note'&&!child(item,'grace')){
     const duration=num(item,'duration')/divisions,onset=child(item,'chord')?previousStart:cursor;
     const pitch=child(item,'pitch');
     if(pitch&&duration>0&&value(pitch,'step')in pitchClasses){
      const midi=(num(pitch,'octave')+1)*12+pitchClasses[value(pitch,'step')]+num(pitch,'alter');
      if(Number.isInteger(midi)&&midi>=0&&midi<=127){
       notes.push({midi,onset,duration,measure:index,part:partIndex,voice:value(item,'voice')||'1',staff:num(item,'staff',1)});
       for(const lyric of children(item,'lyric')){
        const words=children(lyric,'text').map(text).join('');
        if(words.trim())lyrics.push({measure:index,onset,part:partIndex,voice:value(item,'voice')||'1',verse:lyric.attributes['@_number']||'1',syllabic:value(lyric,'syllabic')||'single',text:words.trim()});
       }
      }
     }
     if(!child(item,'chord')){previousStart=cursor;cursor+=duration}end=Math.max(end,onset+duration,cursor);
    }
   }
   const current=measures[index];
   if(partIndex===0)Object.assign(current,{beats,beatType,fifths,mode});
   current.length=Math.max(current.length,end);
  }
  if(!ownDivisions&&defaultDivisions!==1)recognitionWarnings.push('A recognized part omitted timing resolution; the score-wide resolution was used. Check rhythmic alignment.');
 }
 if(!notes.length)throw new Error('No musical notes were recognized. Use a sharper, straight-on photo.');
 let offset=0;
 if(notes.length>20000||measures.length>1000)throw new Error('This score is too large for one photo.');
 for(const measure of measures){
  if(measure.length>64)throw new Error('The recognized timing is inconsistent. Try a clearer score image.');
  const nominal=measure.beats*4/measure.beatType;
  if(!measure.length)measure.length=nominal;
  if(!measure.implicit&&!(measure.index===0&&measure.length<nominal)){
   if(Math.abs(measure.length-nominal)>.2)recognitionWarnings.push('Some recognized note durations disagree with the meter; measure boundaries were retained. Check the score.');
   measure.length=nominal;
  }
  measure.start=offset;offset+=measure.length;
 }
 for(const event of [...notes,...lyrics])event.time=measures[event.measure].start+event.onset;
 const title=value(root,'movement-title')||value(child(root,'work'),'work-title')||'Your guitar arrangement';
 return {title:title.slice(0,160),measures,notes,lyrics,recognitionWarnings:[...new Set(recognitionWarnings)]};
}
const templates=[['',[0,4,7]],['m',[0,3,7]],['7',[0,4,7,10]],['m7',[0,3,7,10]],['maj7',[0,4,7,11]],['dim',[0,3,6]],['sus4',[0,5,7]]];
export function arrangeChords(score){
 const frames=[];
 let simultaneous=0,polyphonic=false;
 for(const event of score.notes.flatMap(n=>[{time:n.time,delta:1},{time:n.time+n.duration,delta:-1}]).sort((a,b)=>a.time-b.time||a.delta-b.delta)){simultaneous+=event.delta;if(simultaneous>=3){polyphonic=true;break}}
 for(const measure of score.measures){
  // A compound beat is three eighth notes; simple meters use quarter beats.
  const beat=polyphonic?(measure.beatType===8&&measure.beats%3===0?1.5:4/measure.beatType):measure.length;
  for(let onset=0;onset<measure.length-.001;onset+=beat){
   const start=measure.start+onset,end=measure.start+Math.min(measure.length,onset+beat),hist=new Array(12).fill(0);
   const active=score.notes.filter(n=>n.time<end&&n.time+n.duration>start);
   if(!active.length){frames.push({measure:measure.index,onset,time:start,chord:null});continue}
   const lowest=Math.min(...active.map(n=>n.midi));
   for(const note of active){const overlap=Math.min(end,note.time+note.duration)-Math.max(start,note.time);hist[mod(note.midi)]+=overlap*(note.midi===lowest?1.6:1)}
   const total=hist.reduce((a,b)=>a+b,0),tonic=mod(measure.fifths*7+(measure.mode==='minor'?9:0));
   const scale=new Set((measure.mode==='minor'?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11]).map(x=>mod(x+tonic)));
   const choices=[];
   for(let root=0;root<12;root++)for(const [suffix,intervals]of templates){
    const pcs=intervals.map(x=>mod(root+x)),coverage=pcs.reduce((sum,pc)=>sum+hist[pc],0)/total;
    let quality=coverage*3-(1-coverage)*2+(mod(lowest)===root?.9:0)-(intervals.length-3)*.45;
    if(pcs.every(pc=>scale.has(pc)))quality+=.13;
    // Favor a supported third, avoid assigning a seventh from a passing tone.
    if(hist[pcs[1]]>0)quality+=.1;
    choices.push({root,suffix,quality,chord:(measure.fifths<0?flatNames:sharpNames)[root]+suffix});
   }
   frames.push({measure:measure.index,onset,time:start,choices});
  }
 }
 // Small transition penalty discourages a new harmony on every passing note.
 let previous=[];
 for(const frame of frames){
  if(!frame.choices)continue;
  for(const choice of frame.choices){let best=null,bestScore=-Infinity;
   for(const prior of previous){const result=prior.pathScore-(prior.chord===choice.chord?0:.65);if(result>bestScore){best=prior;bestScore=result}}
   choice.pathScore=choice.quality+(best?bestScore:0);choice.previous=best;
  }
  previous=frame.choices;
 }
 let winner=previous.reduce((best,x)=>!best||x.pathScore>best.pathScore?x:best,null);
 for(const frame of [...frames].reverse()){if(frame.choices){frame.chord=winner?.chord||null;winner=winner?.previous}}
 return frames.map(({choices,...frame})=>frame);
}
export function scoreToChart(input){
 const score=readMusicXML(input),frames=arrangeChords(score);
 const at=time=>{let result=null;for(const frame of frames){if(frame.time>time+.001)break;if(frame.chord)result=frame.chord}return result};
 const unique=new Map();
 for(const lyric of score.lyrics){const key=[lyric.part,lyric.voice,lyric.verse,lyric.time,lyric.text].join('|');unique.set(key,lyric)}
 const groups=new Map();
 for(const lyric of unique.values()){const key=[lyric.part,lyric.voice,lyric.verse].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(lyric)}
 const ranked=[...groups.values()].filter(group=>group.filter(x=>/\p{L}{2,}/u.test(x.text)).length>=3).sort((a,b)=>b.length-a.length);
 let rows=[],lyrical=false;
 if(ranked.length){
  lyrical=true;const primary=ranked[0],verses=ranked.filter(g=>g[0].part===primary[0].part&&g[0].voice===primary[0].voice).sort((a,b)=>String(a[0].verse).localeCompare(String(b[0].verse),undefined,{numeric:true}));
  for(const verse of verses){rows.push({lyrics:'Verse '+verse[0].verse,chords:[],section:true});let row={lyrics:'',chords:[]},lastChord=null,lastMeasure=-1,join=false;
   for(const lyric of verse.sort((a,b)=>a.time-b.time)){
    if(lyric.measure!==lastMeasure&&row.lyrics.length>45){rows.push(row);row={lyrics:'',chords:[]};join=false}
    if(row.lyrics&&!join)row.lyrics+=' ';
    const chord=at(lyric.time),column=Array.from(row.lyrics).length;
    if(chord&&(chord!==lastChord||!row.chords.length)){row.chords.push({text:chord,column});lastChord=chord}
    row.lyrics+=lyric.text;join=lyric.syllabic==='begin'||lyric.syllabic==='middle';lastMeasure=lyric.measure;
   }
   if(row.lyrics)rows.push(row);
  }
 }else{
  rows=score.measures.map(measure=>{
   const measureFrames=frames.filter(f=>f.measure===measure.index),beat=measure.beatType===8&&measure.beats%3===0?1.5:4/measure.beatType;
   let lyrics='',chords=[],last=null;
   for(const frame of measureFrames){const label=`beat ${Math.round(frame.onset/beat)+1}`;const column=lyrics.length;lyrics+=label.padEnd(12,' ');if(frame.chord&&frame.chord!==last){chords.push({text:frame.chord,column});last=frame.chord}}
   return [{lyrics:'Measure '+measure.number,chords:[],section:true},{lyrics:lyrics.trimEnd(),chords}];
  }).flat();
 }
 if(!rows.some(r=>r.chords.length))throw new Error('The recognized notes did not produce a usable chord guide.');
 return {title:score.title,subtitle:lyrical?'Suggested guitar accompaniment · check recognition':'Instrumental chord guide · no lyrics recognized',rows,lyrical,measures:score.measures.length,noteCount:score.notes.length,warnings:[...score.recognitionWarnings,'Suggested accompaniment, not a verified transcription of the original harmony.','Music recognition can misread notes or lyrics. Check against your original.','Repeats are shown in printed order, not expanded into playback order.']};
}
