import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {prepareScoreImage} from './score-image.js';
test('aged-paper correction removes the color cast while preserving dark staff strokes',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'fretmate-image-test-'));
 try{
  const w=600,h=900,data=Buffer.alloc(w*h*3);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const grain=(x*17+y*31)%19-9,ink=x>60&&x<540&&[200,210,220,230,240].some(row=>Math.abs(y-row)<=1),i=(y*w+x)*3;
   data[i]=ink?25:220+grain;data[i+1]=ink?25:190+grain;data[i+2]=ink?25:145+grain;
  }
  const input=await sharp(data,{raw:{width:w,height:h,channels:3}}).png().toBuffer(),file=path.join(dir,'prepared.png');
  assert.equal((await prepareScoreImage(input,file)).aged,true);
  const {data:out,info}=await sharp(file).raw().toBuffer({resolveWithObject:true}),pixel=(x,y)=>out[(y*info.width+x)*info.channels];
  assert.equal(info.width,2400);assert.ok(pixel(1200,400)>245,'paper becomes near white');assert.ok(pixel(1200,882)<50,'staff-line center remains dark');
  const white=await sharp({create:{width:600,height:900,channels:3,background:'white'}}).png().toBuffer();assert.equal((await prepareScoreImage(white,file)).aged,false);
 }finally{await rm(dir,{recursive:true,force:true})}
});
