import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeQuery,rankSongs,createSongSearch} from './song-search.js';
const song=(id,title,artist)=>({kind:'song',trackId:id,trackName:title,artistName:artist,collectionName:'Test album',releaseDate:'2025-01-01'});
const fixture=[song(1,'Dracula','Other Artist'),song(2,'Dracula','Tame Impala'),song(3,'Another Song','Tame Impala')];
test('normalizes and bounds searches',()=>{
 assert.equal(normalizeQuery('  Dracula\n Tame\tImpala  '),'Dracula Tame Impala');assert.equal(normalizeQuery(null),'');assert.equal(normalizeQuery('x'.repeat(150)).length,120);
});
test('title and artist tokens rank the requested recording first',()=>{
 const results=rankSongs(fixture,'Dracula tame impala');assert.equal(results[0].id,'2');assert.equal(results[0].title,'Dracula');assert.equal(results[0].artist,'Tame Impala');assert.match(results[0].spotifyUrl,/Dracula%20Tame%20Impala/);
});
test('duplicates and malformed records are omitted and metadata never supplies arbitrary links',()=>{
 const rows=rankSongs([...fixture,song(4,'Dracula','Tame Impala'),{kind:'podcast',trackId:12},song(5,'<script>','A & B')],'dracula');
 assert.equal(rows.filter(x=>x.title==='Dracula'&&x.artist==='Tame Impala').length,1);assert.equal(rows.length,4);assert.ok(rows.every(x=>x.sourceUrl.startsWith('https://music.apple.com/')));
});
test('short queries do not call the catalog and real query parameters are URL-encoded',async()=>{
 let calls=0;const search=createSongSearch(async(url,options)=>{calls++;assert.equal(url.hostname,'itunes.apple.com');assert.equal(url.searchParams.get('term'),'Dracula & Tame Impala');assert.equal(url.searchParams.get('entity'),'song');assert.ok(options.signal);return {ok:true,json:async()=>({results:fixture})}});
 assert.deepEqual(await search('D'),[]);assert.equal(calls,0);assert.equal((await search('Dracula & Tame Impala'))[0].title,'Dracula');assert.equal(calls,1);
});
test('same-query requests are coalesced and cached, then refreshed after expiry',async()=>{
 let clock=0,calls=0,release;
 const search=createSongSearch(async()=>{calls++;await new Promise(r=>release=r);return {ok:true,json:async()=>({results:fixture})}},{now:()=>clock});
 const first=search('Dracula'),second=search('dracula');release();assert.deepEqual(await first,await second);await search('Dracula');assert.equal(calls,1);
 clock=300001;const refreshed=search('Dracula');release();await refreshed;assert.equal(calls,2);
});
test('provider failures and rate limits are actionable, never fake results',async()=>{
 await assert.rejects(createSongSearch(async()=>{throw new Error('network denied')})('Dracula'),/could not connect/);
 const limited=createSongSearch(async()=>({ok:false,status:429}));await assert.rejects(limited('Dracula'),e=>e.status===429);
 await assert.rejects(createSongSearch(async()=>({ok:true,json:async()=>({unexpected:true})}))('Dracula'),/unreadable/);
 assert.deepEqual(await createSongSearch(async()=>({ok:true,json:async()=>({results:[]})}))('no matches'),[]);
});
