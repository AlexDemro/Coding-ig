import {access,mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
import http from 'node:http';
import {notationEngine,toolsPath} from '../score-service.js';
http.setGlobalProxyFromEnv?.();
const run=promisify(execFile);
const version='5.11.0';
async function download(url){const response=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw new Error('Download failed: '+response.status+' '+url);return Buffer.from(await response.arrayBuffer())}
function verify(data,hash,label){if(createHash('sha256').update(data).digest('hex')!==hash)throw new Error(label+' checksum verification failed; refusing to use it.')}
try{
 await mkdir(toolsPath,{recursive:true});
 let command=await notationEngine();
 if(!command&&process.platform==='linux'&&process.arch==='x64'){
  const archive=await download(`https://github.com/Audiveris/audiveris/releases/download/${version}/Audiveris-${version}-ubuntu22.04-x86_64.deb`);
  verify(archive,'ae714594f40e54b1a4951fc3f914f08ae38fe5d07b7f2283b1a904fdb6e0a318','Audiveris installer');
  const file=path.join(toolsPath,'audiveris-'+version+'.deb');await writeFile(file,archive);
  await run('dpkg-deb',['-x',file,path.join(toolsPath,'audiveris')]);
  const config=path.join(toolsPath,'audiveris/opt/audiveris/lib/app/Audiveris.cfg');
  await writeFile(config,(await readFile(config,'utf8')).replace('java-options=-Xmx8G','java-options=-Xmx2G'));
  command=await notationEngine();
 }
 if(!command){
  console.error('Install the official Audiveris '+version+' release, then run this setup again.');
  console.error('Official releases: https://github.com/Audiveris/audiveris/releases/tag/'+version);
  if(process.platform==='win32')console.error('Windows installer: https://github.com/Audiveris/audiveris/releases/download/'+version+'/Audiveris-'+version+'-windowsConsole-x86_64.msi');
  console.error('If automatic detection fails, set AUDIVERIS_COMMAND to the full path of its executable.');process.exitCode=1;
 }else{
  if(command.startsWith(toolsPath)){
   const config=path.join(toolsPath,'audiveris/opt/audiveris/lib/app/Audiveris.cfg');
   try{await writeFile(config,(await readFile(config,'utf8')).replace('java-options=-Xmx8G','java-options=-Xmx2G'))}catch(error){if(error.code!=='ENOENT')throw error}
  }
  const directory=path.join(toolsPath,'tessdata');await mkdir(directory,{recursive:true});const file=path.join(directory,'eng.traineddata');
  let existing=false;try{await access(file);existing=true}catch{}
  if(existing){const digest=createHash('sha256').update(await readFile(file)).digest('hex');if(digest==='5dc5d8d640a212c9d6184921ba103b186f50e0fed9ee716c53e6b312b400d747')existing=false}
  if(!existing){const model=gunzipSync(await download('https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0/eng.traineddata.gz'));verify(model,'daa0c97d651c19fba3b25e81317cd697e9908c8208090c94c3905381c23fc047','English lyric model');await writeFile(file,model)}
  console.log('Staff recognition setup is installed. Restart npm start.');console.log('Engine: '+command);console.log('This does not deploy a backend to Hostinger shared hosting.');
 }
}catch(error){console.error('Staff recognition setup failed: '+error.message);process.exitCode=1}
