import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {readLyricSystems} from './score-recovery.js';
test('a stalled OCR job times out and terminates its worker instead of holding the reader busy',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'fretmate-ocr-timeout-'));let terminated=0;
 try{
  const file=path.join(dir,'page.png');await sharp({create:{width:800,height:1000,channels:3,background:'white'}}).png().toFile(file);
  const layout={pairs:[{top:{left:50,right:700,bottom:140,interline:10},bass:{top:250}}]};
  const worker={setParameters:async()=>{},recognize:()=>new Promise(()=>{}),terminate:async()=>{terminated++}};
  await assert.rejects(readLyricSystems(layout,file,{modelPath:dir,cachePath:dir,timeoutMs:25,workerFactory:async()=>worker}),e=>e.code==='UNRELIABLE_SCORE'&&/too long/.test(e.message));
  assert.equal(terminated,1);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('successful OCR returns positioned words and releases its worker',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'fretmate-ocr-success-'));let terminated=0;
 try{
  const file=path.join(dir,'page.png');await sharp({create:{width:800,height:1000,channels:3,background:'white'}}).png().toFile(file);
  const layout={pairs:[{top:{left:50,right:700,bottom:140,interline:10},bass:{top:250}}]};
  const words=['Original','practice','words'].map((text,i)=>({text,confidence:95,bbox:{x0:20+i*70,x1:70+i*70,y0:10,y1:35}}));
  const data={confidence:95,lines:[{text:'Original practice words',confidence:95,bbox:{x0:20,x1:210,y0:10,y1:35},words}]};
  const worker={setParameters:async()=>{},recognize:async()=>({data:structuredClone(data)}),terminate:async()=>{terminated++}};
  const systems=await readLyricSystems(layout,file,{modelPath:dir,cachePath:dir,workerFactory:async()=>worker,timeoutMs:5000});
  assert.equal(systems.length,1);assert.equal(systems[0][0].words.length,3);assert.ok(systems[0][0].words[0].bbox.x0>=50);assert.equal(terminated,1);
 }finally{await rm(dir,{recursive:true,force:true})}
});
