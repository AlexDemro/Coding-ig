import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkScoreConnection} from './score-connection.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
test('a working API enables staff recognition without AbortSignal.timeout support',async()=>{
  const original=Object.getOwnPropertyDescriptor(AbortSignal,'timeout');Object.defineProperty(AbortSignal,'timeout',{value:undefined,configurable:true});
  try{
    const result=await checkScoreConnection({fetcher:async(url,options)=>{
      assert.equal(url,'/api/score-capabilities');assert.equal(options.cache,'no-store');assert.ok(options.signal);return json({available:true});
    }});
    assert.equal(result.available,true);assert.equal(result.code,'READY');
  }finally{if(original)Object.defineProperty(AbortSignal,'timeout',original);else delete AbortSignal.timeout}
});
test('missing server packages or project files give the actual installation remedy',async()=>{
  const result=await checkScoreConnection({fetcher:async()=>json({available:false,code:'OMR_APP_SETUP'})});
  assert.equal(result.code,'OMR_APP_SETUP');assert.match(result.message,/npm install/);assert.match(result.message,/all files/);assert.doesNotMatch(result.message,/Audiveris was not found/);
});
test('missing engines and older setup responses remain distinguishable from network errors',async()=>{
  const engine=await checkScoreConnection({fetcher:async()=>json({available:false,code:'OMR_ENGINE_MISSING'})});assert.equal(engine.code,'OMR_ENGINE_MISSING');assert.match(engine.message,/setup:omr/);
  const old=await checkScoreConnection({fetcher:async()=>json({available:false,code:'OMR_SETUP'})});assert.equal(old.code,'OMR_SETUP');assert.match(old.message,/do not need to reinstall/);
});
test('static servers and HTML fallbacks are not mistaken for a missing engine',async()=>{
  const missing=await checkScoreConnection({fetcher:async()=>new Response('Not found',{status:404})});assert.equal(missing.code,'API_MISSING');assert.match(missing.message,/npm start/);
  const html=await checkScoreConnection({fetcher:async()=>new Response('<html>Static site</html>')});assert.equal(html.code,'API_INVALID');
});
test('connection failures and stalled requests recover with a clear message',async()=>{
  const failed=await checkScoreConnection({fetcher:async()=>{throw new TypeError('Connection refused')}});assert.equal(failed.code,'API_UNREACHABLE');
  const timedOut=await checkScoreConnection({timeoutMs:10,fetcher:(_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}))});assert.equal(timedOut.code,'API_UNREACHABLE');assert.match(timedOut.message,/Keep npm start running/);
});
test('opening index.html directly gives localhost instructions without probing an API',async()=>{
  const result=await checkScoreConnection({pageURL:'file:///C:/FretMate/index.html',fetcher:()=>{throw Error('must not fetch')}});assert.equal(result.code,'LOCAL_FILE');assert.match(result.message,/http:\/\/localhost:3000/);
});
test('a remote hosting failure does not suggest a PC installation can repair the website',async()=>{
  const result=await checkScoreConnection({pageURL:'https://fretmate.online/',fetcher:async()=>json({available:false,code:'OMR_ENGINE_MISSING'})});assert.equal(result.available,false);assert.match(result.message,/does not enable it on this website/);assert.doesNotMatch(result.message,/Run npm/);
});
