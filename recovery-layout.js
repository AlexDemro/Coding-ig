import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {unzipSync} from 'fflate';
const problem=message=>Object.assign(new Error(message),{code:'UNRELIABLE_SCORE',status:422});
const array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
function collect(node,name){
 const result=[];if(!node||typeof node!=='object')return result;
 for(const [key,value]of Object.entries(node))for(const item of array(value)){if(key===name)result.push(item);if(!key.startsWith('@_'))result.push(...collect(item,name))}
 return result;
}
const attr=(node,key,fallback=0)=>Number.isFinite(Number(node?.['@_'+key]))?Number(node['@_'+key]):fallback;
const box=node=>{const b=node?.bounds;return b?{x:attr(b,'x'),y:attr(b,'y'),w:attr(b,'w'),h:attr(b,'h')}:null};
const mod=(n,m)=>(n%m+m)%m;
const chordNames=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const shapes=[['',[0,4,7]],['m',[0,3,7]],['7',[0,4,7,10]],['m7',[0,3,7,10]]];
export function readRecoveryLayout(archive){
 let bytes=0;const xmls=unzipSync(archive,{filter:entry=>{
  if(!/^sheet#\d+\/sheet#\d+\.xml$/.test(entry.name))return false;
  bytes+=entry.originalSize;if(bytes>32*1024*1024)throw problem('This page is too complex to recover reliably.');return true;
 }});
 if(Object.keys(xmls).length!==1)throw problem('Use one page at a time for lyric-sheet recovery.');
 const xml=new TextDecoder().decode(Object.values(xmls)[0]);
 if(/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw problem('The notation output could not be checked.');
 const root=new XMLParser({ignoreAttributes:false,parseAttributeValue:false}).parse(xml),staves=[];
 for(const system of collect(root,'system')){
  const inters=system.sig?.inters||{};
  for(const part of array(system.part))for(const staff of array(part.staff)){
   if(!staff.lines)continue;
   const id=staff['@_id'],points=array(staff.lines.line).map(l=>array(l.point)[0]);if(points.length!==5)throw problem('Recovery needs ordinary five-line staves.');
   const top=attr(points[0],'y'),bottom=attr(points[4],'y'),interline=(bottom-top)/4;
   const own=name=>array(inters[name]).filter(item=>item['@_staff']===id);
   staves.push({id,top,bottom,interline,left:attr(staff,'left'),right:attr(staff,'right'),heads:own('head').filter(h=>box(h)).map(h=>({id:h['@_id'],pitch:attr(h,'pitch'),grade:attr(h,'grade'),shape:h['@_shape'],bounds:box(h)})),clefs:own('clef').map(c=>c['@_kind']),keys:own('key').filter(k=>k['@_fifths']!==undefined).map(k=>({fifths:attr(k,'fifths'),grade:attr(k,'grade')})),alters:own('alter').filter(a=>box(a)).map(a=>({pitch:attr(a,'pitch'),shape:a['@_shape'],bounds:box(a)})),words:own('word').filter(w=>box(w)).map(w=>({text:w['@_value']||'',bounds:box(w),grade:attr(w,'grade')})),bars:array(system.stack).map(s=>({left:attr(s,'left'),right:attr(s,'right')}))});
  }
 }
 staves.sort((a,b)=>a.top-b.top);
 if(staves.length<4||staves.length>24||staves.length%2)throw problem('This score could not be recovered confidently. Try a clearer modern scan.');
 const topKeys=staves.filter((_,i)=>i%2===0).flatMap(s=>s.keys).filter(k=>k.grade>=.4);
 if(topKeys.length<2||!topKeys.every(k=>k.fifths===topKeys[0].fifths))throw problem('The melody’s key signature is not clear enough for a reliable recovery.');
 const fifths=topKeys[0].fifths;
 if(!Number.isInteger(fifths)||Math.abs(fifths)>7)throw problem('The key signature could not be read reliably.');
 const changes=new Map(),order=fifths<0?[6,2,5,1,4,0,3]:[3,0,4,1,5,2,6];
 for(const step of order.slice(0,Math.abs(fifths)))changes.set(step,Math.sign(fifths));
 const pairs=[];let measureIndex=0,totalHeads=0,keptHeads=0;
 for(let i=0;i<staves.length;i+=2){
  const top=staves[i],bass=staves[i+1];
  if(!top.clefs.includes('TREBLE')||!bass.clefs.includes('BASS')||Math.abs(top.interline-bass.interline)>top.interline*.15||Math.abs(top.left-bass.left)>top.interline*3.5||bass.top-top.bottom>top.interline*21||bass.top<=top.bottom)throw problem('The paired treble and bass staves could not be matched confidently.');
  const bars=top.bars.filter(b=>b.right>b.left).map(b=>({...b,index:measureIndex++,notes:[],events:[]}));
  if(!bars.length||bars.length>64)throw problem('The measure boundaries could not be recovered.');
  for(const [staffIndex,staff]of [top,bass].entries()){
   totalHeads+=staff.heads.length;
   for(const head of staff.heads){
    if(head.grade<.45||(Math.abs(head.pitch)>4&&head.grade<.6)||!Number.isInteger(head.pitch)||Math.abs(head.pitch)>24)continue;
    const x=head.bounds.x+head.bounds.w/2,bar=bars.find(b=>x>=b.left-10&&x<=b.right+10);if(!bar)continue;
    const diatonic=(staffIndex===0?34:22)-head.pitch,octave=Math.floor(diatonic/7),step=mod(diatonic,7);
    let accidental=changes.get(step)||0;
    const alter=staff.alters.filter(a=>a.pitch===head.pitch&&a.bounds.x+a.bounds.w<x&&a.bounds.x>bar.left).sort((a,b)=>b.bounds.x-a.bounds.x)[0];
    if(alter)accidental=({SHARP:1,NATURAL:0,FLAT:-1,DOUBLE_SHARP:2,DOUBLE_FLAT:-2})[alter.shape]??accidental;
    const midi=(octave+1)*12+[0,2,4,5,7,9,11][step]+accidental;
    if(midi<28||midi>96)continue;
    bar.notes.push({...head,x,staff:staff.id,midi});keptHeads++;
   }
  }
  if(bars.reduce((n,b)=>n+b.notes.length,0)<12)throw problem('Too few reliable noteheads were found in one of the systems.');
  const marker=top.words.find(w=>w.grade>=.45&&/^(chorus|refrain)\b/i.test(w.text));
  pairs.push({top,bass,bars,marker:marker?{x:marker.bounds.x-top.interline*.5,name:/refrain/i.test(marker.text)?'Refrain':'Chorus'}:null});
 }
 if(keptHeads<40||keptHeads/Math.max(1,totalHeads)<.7)throw problem('Too many noteheads were unclear for lyric-sheet recovery.');
 return {pairs,fifths,noteCount:keptHeads,measures:measureIndex};
}
function supportedChord(notes,previous){
 const pcs=new Set(notes.map(n=>mod(n.midi,12))),lowest=mod(Math.min(...notes.map(n=>n.midi)),12);let best=null;
 for(let root=0;root<12;root++)for(const [suffix,intervals]of shapes){
  const tones=intervals.map(i=>mod(root+i,12)),core=tones.slice(0,3),coverage=tones.filter(pc=>pcs.has(pc)).length/pcs.size;
  if(!core.every(pc=>pcs.has(pc))||!core.includes(lowest)||coverage<.75||(tones.length===4&&!pcs.has(tones[3])))continue;
  const chord=chordNames[root]+suffix,score=coverage*4+(lowest===root?.6:0)+(previous===chord?.3:0)-(tones.length===4?.1:0);
  if(!best||score>best.score)best={chord,score,root,tones};
 }
 return {best,pcs:[...pcs],lowest};
}
export function recoverHarmonies(layout){
 let held=null,strong=0,count=0;
 for(const pair of layout.pairs){
  const staffState=new Map();
  for(const bar of pair.bars){
   const clusters=[];
   for(const n of [...bar.notes].sort((a,b)=>a.x-b.x)){
    const prior=clusters.at(-1);
    if(prior&&n.x-prior.x<pair.top.interline*1.4){prior.notes.push(n);prior.x=prior.notes.reduce((sum,n)=>sum+n.x,0)/prior.notes.length}else clusters.push({x:n.x,notes:[n]});
   }
   for(const cluster of clusters){
    for(const sid of new Set(cluster.notes.map(n=>n.staff)))staffState.set(sid,cluster.notes.filter(n=>n.staff===sid));
    const {best,pcs,lowest}=supportedChord([...staffState.values()].flat(),held);count++;
    if(best){held=best.chord;strong++;
     // A later, complete triad can identify earlier root/fifth-only voicings in
     // the same measure. Do not backfill across a different supported chord.
     for(const earlier of [...bar.events].reverse()){
      if(earlier.strong)break;
      const passing=new Set([...best.tones,...[2,5,9,10].map(n=>mod(best.root+n,12))]);
      if(earlier.lowest===best.root&&earlier.pcs.filter(pc=>best.tones.includes(pc)).length>=2&&earlier.pcs.every(pc=>passing.has(pc))){
       const seventh=earlier.pcs.includes(mod(best.root+10,12));
       earlier.chord=seventh&&!best.chord.endsWith('7')?best.chord+'7':best.chord;
      }
     }
    }
    bar.events.push({x:cluster.x,chord:held,pcs,lowest,strong:Boolean(best)});
   }
  }
 }
 if(!held||strong/Math.max(1,count)<.4)throw problem('Too few complete chords were recognized to suggest a reliable accompaniment.');
 return layout;
}
export function syllablesFromWord(word){
 if(/^\d+[.,]$/.test(word.text.trim()))return [];
 if(/^[-–]+$/.test(word.text.trim()))return [{connect:true}];
 const symbols=word.symbols?.length?word.symbols:Array.from(word.text).map((text,i,a)=>({text,bbox:{x0:word.bbox.x0+(word.bbox.x1-word.bbox.x0)*i/a.length,x1:word.bbox.x0+(word.bbox.x1-word.bbox.x0)*(i+1)/a.length,y0:word.bbox.y0,y1:word.bbox.y1}}));
 const gaps=symbols.slice(1).map((s,i)=>s.bbox.x0-symbols[i].bbox.x1).filter(g=>g>=0).sort((a,b)=>a-b),median=gaps[Math.floor(gaps.length/2)]||0,height=Math.max(1,...symbols.map(s=>s.bbox.y1-s.bbox.y0));
 const result=[];let current=null,joinPrevious=false;
 const flush=()=>{if(current&&/\p{L}/u.test(current.text)){result.push({...current,x:(current.left+current.right)/2,joinPrevious});joinPrevious=false}current=null};
 for(const [i,symbol]of symbols.entries()){
  const char=symbol.text.normalize('NFKC');
  if(/[-–]/.test(char)){flush();if(result.length)result.at(-1).joinNext=true;else joinPrevious=true;continue}
  const gap=i?symbol.bbox.x0-symbols[i-1].bbox.x1:0;
  if(/\s/.test(char)||(i>=2&&symbols.length-i>=2&&!word.text.includes('-')&&gap>height*.25&&gap>median*2.8)){flush();if(/\s/.test(char))continue}
  if(!current)current={text:'',left:symbol.bbox.x0,right:symbol.bbox.x1};
  current.text+=char;current.right=symbol.bbox.x1;
 }
 flush();if(/[-–]$/.test(word.text)&&result.length)result.at(-1).joinNext=true;
 return result;
}
export function agreeingWordConfidence(word,originals,xOffset=0){
 const letters=text=>text.replace(/[^\p{L}]/gu,'').toLowerCase(),x=(word.bbox.x0+word.bbox.x1)/2+xOffset;
 const agreed=originals.find(w=>letters(w.text)&&letters(w.text)===letters(word.text)&&Math.abs((w.bbox.x0+w.bbox.x1)/2-x)<Math.max(8,(word.bbox.y1-word.bbox.y0)*.6));
 return agreed?Math.max(word.confidence,agreed.confidence):word.confidence;
}
export function buildRecoveredRows(layout,systems){
 const sections=new Map();let shared=null,uncertain=0,wordCount=0,expectedVerses=systems[0]?.length||0;
 for(const [index,pair]of layout.pairs.entries()){
  const lines=systems[index];if(!lines?.length)throw problem('A lyric system was not readable enough to include in the image.');
  if(!shared&&lines.length<expectedVerses&&!pair.marker)throw problem('Some verse lines are missing from recognition. Try a clearer scan.');
  for(const [verse,line]of lines.entries()){
   let row=null,section=null,join=false,lastChord=null;
   const push=()=>{if(row?.lyrics.trim()){if(!sections.has(section))sections.set(section,[]);sections.get(section).push(row)}};
   for(const word of line.words){
    if(word.confidence<35&&/\p{L}/u.test(word.text))throw problem('A lyric word is too unclear to include confidently. Try a sharper scan.');
    for(const syllable of syllablesFromWord(word)){
     if(syllable.connect){join=true;continue}
     const name=shared||(pair.marker&&syllable.x>=pair.marker.x?pair.marker.name:'Verse '+(verse+1));
     if(name!==section){push();section=name;row={lyrics:'',chords:[]};join=false;lastChord=null}
     if(row.lyrics&&!join&&!syllable.joinPrevious)row.lyrics+=' ';
     const bar=pair.bars.find(b=>syllable.x>=b.left&&syllable.x<=b.right),event=bar?.events.reduce((best,e)=>!best||Math.abs(e.x-syllable.x)<Math.abs(best.x-syllable.x)?e:best,null),chord=event?.chord||'?';
     if(chord!==lastChord||!row.chords.length){row.chords.push({text:chord,column:Array.from(row.lyrics).length,...(chord==='?'?{uncertain:true}:{})});if(chord==='?')uncertain++;lastChord=chord}
     row.lyrics+=syllable.text;join=syllable.joinNext||false;wordCount++;
    }
   }
   push();
  }
  if(pair.marker)shared=pair.marker.name;
 }
 if(wordCount<20||uncertain>Math.max(3,wordCount*.08))throw problem('Too many lyric positions have uncertain harmony to produce a useful image.');
 const rows=[...sections].flatMap(([name,lines])=>[{lyrics:name,chords:[],section:true},...lines]);
 return {title:'Your guitar practice sheet',subtitle:'Simplified accompaniment · ? marks chords to check',rows,lyrical:true,chordSource:'suggested',recoveryMode:'note-positions',noteCount:layout.noteCount,measures:layout.measures,uncertainChords:uncertain,warnings:['Simplified guitar accompaniment inferred from strong notehead positions, not a transcription of the printed rhythms.','The primary melody key is used for the paired keyboard/choir staves.','Lyrics are OCR text and must be compared with the original. Question marks identify sections without sufficient note evidence.']};
}
