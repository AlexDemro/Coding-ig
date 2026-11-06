import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGuitarPartySource} from './guitarparty-source.js';
import {createChartSource} from './chart-source.js';
const selected={title:'Example Song',artist:'Example Artist'};
const chart={id:7,title:selected.title,artists:[{name:selected.artist}],body:'[G]Original fixture words [C]for this test'};
const json=value=>({ok:true,status:200,text:async()=>JSON.stringify(value)});
test('provider searches song titles and fetches provider chart IDs with server-only authentication',async()=>{
 const urls=[];const fetcher=async(url,options)=>{urls.push(url);assert.equal(options.headers['Guitarparty-Api-Key'],'fixture-api-key');assert.equal(options.redirect,'error');assert.ok(url.startsWith('https://api.guitarparty.com/v2/'));return urls.length===1?json({objects:[{id:7,title:selected.title}]}):json(chart)};
 const result=await createGuitarPartySource({key:'fixture-api-key',fetcher})(selected);
 assert.equal(result.chart,chart.body);assert.ok(!JSON.stringify(result).includes('fixture-api-key'));assert.match(urls[0],/query=Example\+Song/);assert.ok(urls[1].endsWith('/songs/7/'));
});
test('configured GuitarParty key enables the real provider adapter without a custom endpoint',async()=>{
 let calls=0;const source=createChartSource({endpoint:'',guitarPartyKey:'fixture-api-key',fetcher:async()=>++calls===1?json({objects:[{id:7,title:selected.title}]}):json(chart)});
 assert.equal((await source(selected)).chart,chart.body);assert.equal(calls,2);
});
test('matching titles by a different artist are rejected, not displayed as the selected song',async()=>{
 let calls=0;const source=createGuitarPartySource({key:'fixture-api-key',fetcher:async()=>++calls===1?json({objects:[{id:7,title:selected.title}]}):json({...chart,artists:[{name:'Other Artist'}]})});
 await assert.rejects(source(selected),error=>error.status===404);
});
test('missing credentials and provider failures are distinct and never leak authentication',async()=>{
 await assert.rejects(createGuitarPartySource({key:''})(selected),e=>e.status===503);
 for(const code of [401,403,429,500])await assert.rejects(createGuitarPartySource({key:'fixture-api-key',fetcher:async()=>({ok:false,status:code})})(selected),e=>!e.message.includes('fixture-api-key')&&[503,429,502].includes(e.status));
 await assert.rejects(createGuitarPartySource({key:'fixture-api-key',fetcher:async()=>json({objects:[]})})(selected),e=>e.status===404);
});
test('unsupported provider formats, HTML bodies, and charts without chords are rejected',async()=>{
 await assert.rejects(createGuitarPartySource({key:'fixture-api-key',fetcher:async()=>json({songs:[]})})(selected),/unsupported/);
 for(const body of ['<div>[G]Words</div>','Only lyrics here']){let count=0;await assert.rejects(createGuitarPartySource({key:'fixture-api-key',fetcher:async()=>++count===1?json({objects:[{id:7,title:selected.title}]}):json({...chart,body})})(selected))}
});
