import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createChartSource} from './chart-source.js';
const selected={id:'2',title:'Test Song',artist:'Test Artist'};
const chart={title:'Test Song',artist:'Test Artist',chart:'[G]Original words for this [C]test chart'};
const response=value=>({ok:true,status:200,text:async()=>JSON.stringify(value)});
test('an unconfigured source reports the missing dependency, never fabricates a chart',async()=>{
 const source=createChartSource({endpoint:'',guitarPartyKey:'',fetcher:()=>{throw Error('must not fetch')}});
 await assert.rejects(source(selected),error=>error.status===503&&/not connected/.test(error.message));
});
test('validated song and positioned chord data are returned from a configured HTTPS source',async()=>{
 const source=createChartSource({endpoint:'https://charts.example.test/song',token:'test-fixture-token',fetcher:async(url,options)=>{
  assert.equal(url.searchParams.get('title'),selected.title);assert.equal(url.searchParams.get('artist'),selected.artist);assert.equal(options.headers.Authorization,'Bearer test-fixture-token');assert.equal(options.redirect,'error');return response(chart);
 }});
 assert.deepEqual(await source(selected),chart);
});
test('wrong songs and missing chord or lyric data cannot become chart images',async()=>{
 for(const value of [{...chart,artist:'Other Artist'},{...chart,chart:'G C Am'},{...chart,chart:'Just words, no chords'},{...chart,chart:'x'.repeat(40001)}]){
  await assert.rejects(createChartSource({endpoint:'https://charts.example.test',fetcher:async()=>response(value)})(selected),error=>error.status===502);
 }
});
test('insecure configuration, absent charts, unreadable data, and network failures are explicit',async()=>{
 await assert.rejects(createChartSource({endpoint:'http://charts.example.test'})(selected),e=>e.status===503);
 await assert.rejects(createChartSource({endpoint:'https://charts.example.test',fetcher:async()=>({ok:false,status:404})})(selected),e=>e.status===404);
 await assert.rejects(createChartSource({endpoint:'https://charts.example.test',fetcher:async()=>({ok:true,text:async()=>'{bad json'})})(selected),/unreadable/);
 await assert.rejects(createChartSource({endpoint:'https://charts.example.test',fetcher:async()=>{throw Error('offline')}})(selected),/could not be reached/);
});
