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
export function initPhotoReader(){
 let generation=0,worker=null,lastFile;
 function status(message,value=null){$('read-status').textContent=message;$('sheet-progress').hidden=false;if(value===null)$('sheet-progress').removeAttribute('value');else $('sheet-progress').value=value}
 async function process(file){
  const current=++generation,old=worker;worker=null;old?.terminate().catch(()=>{});clearSheetImages();$('sheet-retry').hidden=true;
  $('sheet-file').setAttribute('aria-busy','false');$('sheet-progress').hidden=true;
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024){$('read-status').textContent='Choose a JPG, PNG, or WebP photo under 15 MB.';lastFile=null;return}
  lastFile=file;let local;
  try{
   $('sheet-file').setAttribute('aria-busy','true');status('Preparing your photo…');await loadOCR();if(current!==generation)return;
   local=await window.Tesseract.createWorker('eng',1,{langPath:'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int',logger:message=>{
    if(current!==generation)return;
    if(message.status==='recognizing text')status('Reading your music…',Math.max(0,Math.min(90,(message.progress||0)*90)));
   }});
   if(current!==generation)return;worker=local;
   await local.setParameters({preserve_interword_spaces:'1'});
   const result=await local.recognize(file,{rotateAuto:true},{text:true,blocks:true});if(current!==generation)return;
   const rows=rowsFromOCR(result.data);status('Creating your image…',95);
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
