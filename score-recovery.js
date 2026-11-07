import sharp from 'sharp';
import {createWorker,PSM} from 'tesseract.js';
import {readRecoveryLayout,recoverHarmonies,buildRecoveredRows,agreeingWordConfidence} from './recovery-layout.js';
const problem=message=>Object.assign(new Error(message),{code:'UNRELIABLE_SCORE',status:422});
const moveWord=(word,dx,dy)=>{
 for(const box of [word.bbox,...(word.symbols||[]).map(s=>s.bbox)]){box.x0+=dx;box.x1+=dx;box.y0+=dy;box.y1+=dy}
 return word;
};
export async function readLyricSystems(layout,imageFile,{modelPath,cachePath,report=()=>{},workerFactory=createWorker,timeoutMs=45000}){
 const systems=[];
 let worker,timedOut=false,timeout;
 const recognition=(async()=>{
  report(92,'Rereading lyrics and matching them to reliable note positions…');
  worker=await workerFactory('eng',1,{langPath:modelPath,gzip:false,cachePath,cacheMethod:'none'});
  if(timedOut){await worker.terminate().catch(()=>{});throw problem('Lyric recovery took too long. Try a smaller section.')}
  await worker.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'300'});
  for(const [index,pair]of layout.pairs.entries()){
   if(timedOut)throw problem('Lyric recovery took too long. Try a smaller section.');
   const {top,bass}=pair,left=Math.max(0,Math.floor(top.left-20)),width=Math.floor(top.right-left),first=Math.floor(top.bottom+top.interline*1.8),last=Math.floor(bass.top-top.interline*.7),height=last-first;
   if(width<100||height<20)throw problem('The lyric area could not be located reliably.');
   const buffer=await sharp(imageFile).extract({left,top:first,width,height}).png().toBuffer();
   await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK});
   const {data}=await worker.recognize(buffer,{}, {text:true,blocks:true});
   const lines=(data.lines||[]).filter(line=>line.confidence>=65&&line.words.filter(w=>/\p{L}{2,}/u.test(w.text)&&w.confidence>55).length>=2);
   if(!lines.length||lines.length>8)throw problem('The printed lyrics could not be separated from the notation confidently.');
   const recovered=[];
   for(const original of lines){
    const cropX=Math.max(0,original.bbox.x0-8),cropY=Math.max(0,original.bbox.y0-8),cropW=Math.min(width-cropX,original.bbox.x1-cropX+9),cropH=Math.min(height-cropY,original.bbox.y1-cropY+9);
    const strip=await sharp(buffer).extract({left:cropX,top:cropY,width:cropW,height:cropH}).extend({top:12,bottom:12,left:12,right:12,background:'white'}).png().toBuffer();
    await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_LINE});
    const refined=await worker.recognize(strip,{}, {text:true,blocks:true});
    const useRefined=refined.data.lines?.length===1&&refined.data.confidence>=75,line=useRefined?refined.data.lines[0]:original;
    if(line.confidence<75)throw problem('A lyric line is still too uncertain to include. Try a clearer scan.');
    if(useRefined)for(const word of line.words){
     // A hyphenated syllable can receive a low word score in single-line mode.
     // Accept the stronger pass only when the SAME letters agree at the same
     // printed position. This does not substitute words from a song catalog.
     word.confidence=agreeingWordConfidence(word,original.words,cropX-12);
    }
    const dx=left+(useRefined?cropX-12:0),dy=first+(useRefined?cropY-12:0);
    recovered.push({...line,words:line.words.map(word=>moveWord(word,dx,dy))});
   }
   systems.push(recovered);report(92+Math.round((index+1)/layout.pairs.length*5),'Placing suggested chords above the recognized words…');
  }
  return systems;
 })();
 try{
  return await Promise.race([recognition,new Promise((_,reject)=>{timeout=setTimeout(()=>{timedOut=true;reject(problem('Lyric recovery took too long. Try a smaller section.'))},timeoutMs)})]);
 }catch(error){
  if(error.code==='UNRELIABLE_SCORE')throw error;
  throw problem(timedOut?'Lyric recovery took too long. Try a smaller section.':'This score still could not be recovered reliably. Try a clearer modern scan.');
 }finally{clearTimeout(timeout);if(worker)await worker.terminate().catch(()=>{})}
}

export async function recoverLyricChart(archive,imageFile,options){
 const layout=recoverHarmonies(readRecoveryLayout(archive)),systems=await readLyricSystems(layout,imageFile,options);
 return buildRecoveredRows(layout,systems);
}
