import {scoreApiBase} from './score-config.js';
import {rowsFromOCR} from './sheet-reader.js';
import {clearSheetImages,renderSheetImages} from './charts-ui.js';
const $=id=>document.getElementById(id);
let ocrPromise;
function loadOCR(){
 if(window.Tesseract)return Promise.resolve();
 ocrPromise??=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  script.onload=resolve;script.onerror=()=>{ocrPromise=null;script.remove();reject(new Error('The photo reader could not load. Check your internet connection, then try again.'))};document.head.append(script);
 });return ocrPromise;
}
function scoreURL(route){return scoreApiBase.replace(/\/$/,'')+route}
async function capabilities(){
 try{const response=await fetch(scoreURL('/api/score-capabilities'),{signal:AbortSignal.timeout(5000)});if(!response.ok)return {available:false};return await response.json()}catch{return {available:false}}
}
async function recognizeScore(file,report,isCurrent){
 const response=await fetch(scoreURL('/api/score'),{method:'POST',headers:{'Content-Type':file.type},body:file});
 const submitted=await response.json();if(!response.ok)throw Object.assign(new Error(submitted.error||'The score could not be uploaded.'),{code:submitted.code});
 const started=Date.now();
 while(Date.now()-started<210000){
  if(!isCurrent())return null;
  const poll=await fetch(scoreURL('/api/score/'+encodeURIComponent(submitted.id)));const job=await poll.json();
  if(!poll.ok)throw new Error(job.error||'The recognition job could not be found.');
  if(job.state==='done')return job.result;
  if(job.state==='error')throw Object.assign(new Error(job.message),{code:job.code});
  report(job.message||'Reading the printed score…',Math.min(92,job.progress||10));
  await new Promise(resolve=>setTimeout(resolve,800));
 }
 throw new Error('The score took too long to read. Try a smaller, sharper crop.');
}
export function initPhotoReader(){
 let generation=0,worker=null,lastFile;
 capabilities().then(result=>{$('reader-capability').textContent=result.available?'Staff-note recognition is enabled. Chords are suggested arrangements.':'Staff-note recognition is not enabled on this host. Printed lyric-and-chord charts still work.'});
 function status(message,value=null){$('read-status').textContent=message;$('sheet-progress').hidden=false;if(value===null)$('sheet-progress').removeAttribute('value');else $('sheet-progress').value=value}
 async function process(file){
  const current=++generation,old=worker;worker=null;old?.terminate().catch(()=>{});clearSheetImages();$('sheet-retry').hidden=true;
  $('sheet-file').setAttribute('aria-busy','false');$('sheet-progress').hidden=true;
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024){$('read-status').textContent='Choose a JPG, PNG, or WebP photo under 15 MB.';lastFile=null;return}
  lastFile=file;let local;
  try{
   $('sheet-file').setAttribute('aria-busy','true');status('Preparing your photo…');
   const capability=await capabilities();if(current!==generation)return;
   if(capability.available){
    try{
     const result=await recognizeScore(file,status,()=>current===generation);if(current!==generation||!result)return;
     status('Creating your guitar arrangement image…',96);
     const rendered=await renderSheetImages(result.rows,result);if(current!==generation||!rendered)return;
     $('read-status').textContent=(result.lyrical?'Suggested chords and recognized lyrics are ready.':'Instrumental chord guide ready — no lyrics were recognized.')+' Check notes and chord choices against your original.';
     $('sheet-progress').hidden=true;return;
    }catch(error){if(current!==generation)return;if(error.code!=='NO_NOTATION')throw error;status('Checking for a printed lyric-and-chord chart…')}
   }
   await loadOCR();if(current!==generation)return;
   local=await window.Tesseract.createWorker('eng',1,{langPath:'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int',logger:message=>{
    if(current!==generation)return;
    if(message.status==='recognizing text')status('Reading your music…',Math.max(0,Math.min(90,(message.progress||0)*90)));
   }});
   if(current!==generation)return;worker=local;
   await local.setParameters({preserve_interword_spaces:'1'});
   const result=await local.recognize(file,{rotateAuto:true},{text:true,blocks:true});if(current!==generation)return;
   let rows;
   try{rows=rowsFromOCR(result.data)}catch(error){
    if(!capability.available)throw new Error('Staff-note recognition is not enabled on this host. Your photo needs the installed notation engine, or you can upload a chart that already has printed lyrics and chord names.');
    throw new Error('Neither readable staff notation nor a printed lyric-and-chord chart was found. Try the original, higher-resolution scan rather than a small preview.');
   }
   status('Creating your image…',95);
   const rendered=await renderSheetImages(rows);if(current!==generation||!rendered)return;
   $('read-status').textContent='Your image is ready. Compare it with your original before playing.';$('sheet-progress').hidden=true;
  }catch(error){
   if(current!==generation)return;clearSheetImages();$('sheet-progress').hidden=true;
   $('read-status').textContent=error.message||'The photo could not be read. Please try a clearer image.';$('sheet-retry').hidden=false;
  }finally{
   if(local){try{await local.terminate()}catch{}}
   if(current===generation){worker=null;$('sheet-file').setAttribute('aria-busy','false')}
  }
 }
 $('sheet-file').onchange=()=>process($('sheet-file').files[0]);
 $('sheet-retry').onclick=()=>process(lastFile);
}
document.addEventListener('DOMContentLoaded',initPhotoReader,{once:true});
