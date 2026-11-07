import {readFile} from 'node:fs/promises';
import path from 'node:path';
const file=process.argv[2],base=process.env.SITE_URL||'http://127.0.0.1:3000';
if(!file){console.error('Usage: npm run test:omr -- path/to/score.png [--lyrics]');process.exit(1)}
try{
 const capability=await(await fetch(base+'/api/score-capabilities')).json();if(!capability.available)throw new Error('The notation engine is not available. Run npm run setup:omr and restart the server.');
 const type={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}[path.extname(file).toLowerCase()];if(!type)throw new Error('Use a PNG, JPG, or WebP file.');
 const response=await fetch(base+'/api/score',{method:'POST',headers:{'Content-Type':type},body:await readFile(file)});const result=await response.json();if(!response.ok)throw new Error(result.error);
 const start=Date.now();let last='';
 while(Date.now()-start<250000){
  const response=await fetch(base+'/api/score/'+result.id),job=await response.json();if(!response.ok)throw new Error(job.error);
  if(job.message!==last){console.log(job.progress+'% '+job.message);last=job.message}
  if(job.state==='error')throw new Error(job.message);
  if(job.state==='done'){
   if(!job.result.noteCount||!job.result.rows.some(row=>row.chords.length))throw new Error('No usable note/chord data was produced.');
   if(process.argv.includes('--lyrics')&&!job.result.lyrical)throw new Error('No lyric syllables were recognized.');
   if(job.result.recoveryMode)console.log(`Simplified recovery mode; ${job.result.uncertainChords||0} uncertain chord segment(s) need review.`);
   console.log(`Passed: ${job.result.noteCount} notes, ${job.result.measures} measures, lyrics ${job.result.lyrical?'recognized':'not recognized'}. Check recognition accuracy against the original.`);process.exit(0);
  }
  await new Promise(resolve=>setTimeout(resolve,750));
 }
 throw new Error('Recognition timed out.');
}catch(error){console.error('Recognition check failed: '+error.message);process.exitCode=1}
