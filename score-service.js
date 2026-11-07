import {access,mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scoreToChart} from './musicxml-arranger.js';
import {readRecognitionQuality} from './score-quality.js';
import {prepareScoreImage} from './score-image.js';
import {recoverLyricChart} from './score-recovery.js';
const root=path.dirname(fileURLToPath(import.meta.url));
export const toolsPath=process.env.FRETMATE_TOOLS_DIR||path.resolve(root,'../.fretmate-tools');
export async function notationEngine(){
 const candidates=[process.env.AUDIVERIS_COMMAND,path.join(toolsPath,'audiveris/opt/audiveris/bin/Audiveris')];
 if(process.platform==='win32')for(const base of [process.env.ProgramFiles,process.env['ProgramFiles(x86)']].filter(Boolean))for(const folder of ['Audiveris','AudiverisConsole'])for(const file of ['Audiveris.exe','AudiverisConsole.exe'])candidates.push(path.join(base,folder,file));
 if(process.platform!=='win32')candidates.push('/opt/audiveris/bin/Audiveris','/usr/bin/audiveris');
 for(const candidate of candidates.filter(Boolean))try{await access(candidate,constants.X_OK);return candidate}catch{}
 return null;
}
const problem=(message,status=500,code='SCORE_ERROR')=>Object.assign(new Error(message),{status,code});
export function validPhoto(buffer,type){
 return type==='image/png'?buffer.length>8&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/jpeg'?buffer.length>3&&buffer[0]===255&&buffer[1]===216&&buffer[2]===255:type==='image/webp'?buffer.length>12&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP':false;
}
export function createScoreService({engineFinder=notationEngine,run=spawn,clock=Date.now}={}){
 const jobs=new Map();let active=false;
 function prune(){for(const [id,job]of jobs)if(job.state!=='running'&&job.updated<clock()-15*60*1000)jobs.delete(id);while(jobs.size>=20){const expired=[...jobs].find(([,job])=>job.state!=='running');if(!expired)break;jobs.delete(expired[0])}}
 async function status(){const command=await engineFinder();return {available:Boolean(command),engine:command?'Audiveris':null,code:command?'READY':'OMR_ENGINE_MISSING',message:command?'Staff-note recognition is available.':'The server could not find Audiveris. If it is already installed, run npm run setup:omr in this project folder, then restart npm start.'}}
 async function submit(buffer,type){
  prune();if(active)throw problem('Another score is being read. Please try again shortly.',429,'BUSY');
  if(buffer.length>15*1024*1024||!validPhoto(buffer,type))throw problem('Choose a valid JPG, PNG, or WebP photo under 15 MB.',400,'INVALID_PHOTO');
  const command=await engineFinder();if(!command)throw problem('Staff-note recognition is not installed on this server. Run npm run setup:omr once, then upload the score again.',503,'OMR_SETUP');
  // Reserve before decoding or starting an external process; one OMR job at a time.
  if(active)throw problem('Another score is being read. Please try again shortly.',429,'BUSY');active=true;
  const id=randomUUID(),job={id,state:'running',progress:5,message:'Preparing the score image…',updated:clock()};jobs.set(id,job);
  const update=(progress,message)=>Object.assign(job,{progress:Math.max(job.progress,progress),message,updated:clock()});
  async function work(){
   let directory;
   try{
    directory=await mkdtemp(path.join(tmpdir(),'fretmate-score-'));
    const input=path.join(directory,'score.png'),output=path.join(directory,'recognized');
    const {aged,lowResolution}=await prepareScoreImage(buffer,input);
    await mkdir(output);await Promise.all(['config','cache','data'].map(name=>mkdir(path.join(toolsPath,name),{recursive:true})));
    const model=path.join(toolsPath,'tessdata');let haveModel=false;try{await access(path.join(model,'eng.traineddata'));haveModel=true}catch{}
    const env={...process.env,...(process.platform==='linux'?{XDG_CONFIG_HOME:path.join(toolsPath,'config'),XDG_CACHE_HOME:path.join(toolsPath,'cache'),XDG_DATA_HOME:path.join(toolsPath,'data')}:{}),...(haveModel?{TESSDATA_PREFIX:model}:{})};
    const stages=['LOAD','BINARY','SCALE','GRID','HEADERS','STEM_SEEDS','BEAMS','LEDGERS','HEADS','STEMS','REDUCTION','CUE_BEAMS','TEXTS','MEASURES','CHORDS','CURVES','SYMBOLS','LINKS','RHYTHMS','PAGE'];
    let logs='',lineBuffer='',missingLanguage=false;update(10,'Reading staff lines and musical symbols…');
    await new Promise((resolve,reject)=>{
     const child=run(command,['-batch','-export',...(aged?['-option','org.audiveris.omr.image.Template.maxDistanceLow=0.28']:[]),'-output',output,input],{cwd:directory,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
     let timedOut=false;
     const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');setTimeout(()=>child.kill('SIGKILL'),2500).unref()},180000);timer.unref();
     const capture=chunk=>{logs=(logs+chunk).slice(-30000);lineBuffer+=String(chunk);let newline;
      while((newline=lineBuffer.indexOf('\n'))>=0){const line=lineBuffer.slice(0,newline);lineBuffer=lineBuffer.slice(newline+1);if(/No installed OCR languages|Missing support for 'eng'|Tesseract couldn't load any languages|Could not initialize TessBaseAPI|components are not present/.test(line))missingLanguage=true;const match=line.match(/StepMonitoring\s+\d+\s+\|\s+(\w+)/);if(match){const index=stages.indexOf(match[1]);if(index>=0)update(12+Math.round(index/(stages.length-1)*64),match[1]==='TEXTS'?'Reading lyrics from the score…':match[1]==='RHYTHMS'?'Reading note timing and measures…':'Recognizing the printed score…')}}
     };
     child.stdout.on('data',capture);child.stderr.on('data',capture);
     child.once('error',error=>{clearTimeout(timer);reject(problem(error.code==='ENOENT'?'The notation engine could not start. Check its installation.':'The notation engine could not start.',503,'OMR_SETUP'))});
     child.once('close',code=>{clearTimeout(timer);if(timedOut)reject(problem('This score took too long to read. Try a smaller, sharper crop.',422,'NO_NOTATION'));else if(code!==0)reject(problem('The notation engine could not read this image. Try a sharper, straight-on photo.',422,'NO_NOTATION'));else resolve()});
    });
    if(missingLanguage)throw problem('English lyric recognition is not set up. Run npm run setup:omr to install the language model.',503,'OMR_SETUP');
    const names=await readdir(output);const exported=names.filter(name=>/\.(mxl|musicxml|xml)$/i.test(name));
    if(!exported.length)throw problem('No staff notation was recognized in this image.',422,'NO_NOTATION');
    update(84,'Checking recognized notes, timing, and lyric quality…');
    const native=names.find(name=>name.endsWith('.omr'));
    if(!native)throw problem('The notation engine could not verify its recognition result. Try a clearer scan.',422,'UNRELIABLE_SCORE');
    const archive=await readFile(path.join(output,native)),recognitionQuality=readRecognitionQuality(archive);
    update(90,'Building a suggested guitar accompaniment…');
    let result;
    try{
     if(exported.length!==1)throw problem('The engine split this page into separate scores. A partial score will not be exported.',422,'UNRELIABLE_SCORE');
     result=scoreToChart(await readFile(path.join(output,exported[0])),{recognitionQuality});
    }catch(error){
     if(error.code!=='UNRELIABLE_SCORE')throw error;
     if(recognitionQuality.syllables<6)throw error;
     if(!haveModel)throw problem('Lyric recovery needs the local English model. Run npm run setup:omr in this project folder, then restart npm start.',503,'OMR_SETUP');
     result=await recoverLyricChart(archive,input,{modelPath:model,cachePath:path.join(toolsPath,'cache'),report:update});
    }
    if(lowResolution)result.warnings.unshift('This image is low resolution. Use the original scan for more reliable notes.');
    Object.assign(job,{state:'done',progress:100,message:'Suggested arrangement ready.',result,updated:clock()});
   }catch(error){Object.assign(job,{state:'error',message:['SCORE_ERROR','NO_NOTATION','OMR_SETUP','UNRELIABLE_SCORE'].includes(error.code)?error.message:'The score could not be read reliably. Try a clearer, straight-on photo.',code:error.code||'NO_NOTATION',updated:clock()})}
   finally{if(directory)await rm(directory,{recursive:true,force:true}).catch(()=>{});active=false}
  }
  // Start asynchronously; a client can poll actual recognition stages.
  void work();return {id};
 }
 return {status,submit,get(id){prune();return jobs.get(id)||null}};
}
