import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createScoreService,validPhoto} from './score-service.js';
const png=Buffer.from([137,80,78,71,13,10,26,10,0]);
test('upload types and signatures are checked before launching a native process',()=>{
 assert.equal(validPhoto(png,'image/png'),true);assert.equal(validPhoto(Buffer.from('not an image'),'image/png'),false);assert.equal(validPhoto(png,'text/html'),false);assert.equal(validPhoto(Buffer.from([255,216,255,1]),'image/jpeg'),true);
});
test('missing engine setup is reported without a fake success or processing job',async()=>{
 const service=createScoreService({engineFinder:async()=>null});const status=await service.status();assert.equal(status.available,false);assert.equal(status.code,'OMR_ENGINE_MISSING');await assert.rejects(service.submit(png,'image/png'),error=>error.code==='OMR_SETUP'&&error.status===503);assert.equal(service.get('missing'),null);
});
test('invalid or oversized photos are rejected before engine lookup',async()=>{
 const service=createScoreService({engineFinder:async()=>{throw Error('must not launch')}});
 await assert.rejects(service.submit(Buffer.from('not an image'),'image/png'),e=>e.status===400);await assert.rejects(service.submit(Buffer.alloc(16*1024*1024),'image/png'),e=>e.status===400);
});
