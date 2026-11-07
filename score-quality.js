import {unzipSync} from 'fflate';
import {XMLParser,XMLValidator} from 'fast-xml-parser';
const unreliable=message=>Object.assign(new Error(message),{code:'UNRELIABLE_SCORE',status:422});
// MusicXML drops the engine's recognition grades and abnormal-measure flags.
// Inspect its native output too, before allowing a downloadable arrangement.
export function readRecognitionQuality(archive){
  let bytes=0;
  const sheets=unzipSync(archive,{filter:entry=>{
    if(!/^sheet#\d+\/sheet#\d+\.xml$/.test(entry.name))return false;
    bytes+=entry.originalSize;if(entry.originalSize>32*1024*1024||bytes>64*1024*1024)throw unreliable('This page is too complex to check reliably. Upload a smaller section.');return true;
  }});
  const result={measures:0,abnormalMeasures:0,syllables:0,weakSyllables:0,heads:0,weakHeads:0};
  const visit=node=>{if(!node||typeof node!=='object')return;for(const [name,items]of Object.entries(node)){
    for(const item of Array.isArray(items)?items:[items]){
      if(name==='measure'){result.measures++;if(item?.['@_abnormal']==='true')result.abnormalMeasures++}
      if(name==='lyric-item'&&item?.['@_kind']==='Syllable'){
        result.syllables++;
        // Audiveris WordInter stores OCR confidence × its intrinsic grade ratio
        // rather than a calibrated probability of a correct word.
        if(Number(item['@_grade'])<.60)result.weakSyllables++;
      }
      if(name==='head'){result.heads++;if(Number(item?.['@_ctx-grade']??item?.['@_grade'])<.45)result.weakHeads++}
      if(!name.startsWith('@_'))visit(item);
    }
  }};
  for(const data of Object.values(sheets)){
    const xml=new TextDecoder().decode(data);
    if(/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw unreliable('The score recognition checks could not be completed. Try a clearer scan.');
    visit(new XMLParser({ignoreAttributes:false,parseAttributeValue:false}).parse(xml));
  }
  if(!result.measures)throw unreliable('The notation engine did not return enough information to check this score.');
  return result;
}
export function assertScoreQuality(score,native){
  const inconsistent=score.measures.filter(m=>m.timingMismatch).length;
  if((inconsistent>=2&&inconsistent/score.measures.length>=.2)||(native?.abnormalMeasures>=2&&native.abnormalMeasures/native.measures>=.2))
    throw unreliable('I couldn’t read the notes and measure timing reliably enough to place chords. Try a sharp, straight-on scan, or crop to one complete system of music, including the clefs and key signature.');
  if(native?.heads>=12&&native.weakHeads/native.heads>.25)
    throw unreliable('Too many notes were unclear to make a reliable chord sheet. Use the original scan or a closer, well-lit photo.');
  if(native?.syllables>=6&&(!score.lyrics.length||score.lyrics.length/native.syllables<.65))
    throw unreliable('The reader found lyrics but couldn’t match enough of them to the notes. Try a closer scan of one complete system; I haven’t created an incomplete lyric sheet.');
  if(native?.syllables>=6&&native.weakSyllables/native.syllables>.2)
    throw unreliable('Too many lyric syllables were unclear to make a readable sheet. Try a closer, sharper scan with the lyrics fully visible.');
  const groups=new Map();
  for(const lyric of score.lyrics){const key=[lyric.part,lyric.voice,lyric.verse].join(':');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(lyric)}
  for(const group of groups.values()){
    let joins=false,broken=0;
    for(const lyric of group.sort((a,b)=>a.time-b.time)){
      if(joins&&(lyric.syllabic==='begin'||lyric.syllabic==='single'))broken++;
      if(!joins&&(lyric.syllabic==='middle'||lyric.syllabic==='end'))broken++;
      if(/\p{L}[\d()[\]{}<>|]\p{L}/u.test(lyric.text))broken++;
      joins=lyric.syllabic==='begin'||lyric.syllabic==='middle';
    }
    if(joins)broken++;
    if(group.length>=6&&broken>=3&&broken/group.length>.15)
      throw unreliable('The recognized lyric syllables don’t join into reliable words. Try a sharper scan of one complete system with the lyrics visible.');
  }
}
