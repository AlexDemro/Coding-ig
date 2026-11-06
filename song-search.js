// Public catalog metadata only: this endpoint never retrieves lyrics or chords.
export function normalizeQuery(value){return String(value||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,120)}
const words=value=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function rankSongs(records,query){
  const tokens=words(query).split(' ').filter(Boolean),seen=new Set();
  return records.filter(x=>x.kind==='song'&&x.trackId&&typeof x.trackName==='string'&&typeof x.artistName==='string').map(x=>{
    const title=words(x.trackName),artist=words(x.artistName),combined=title+' '+artist;
    const score=tokens.reduce((n,token)=>n+(title.split(' ').includes(token)?8:artist.split(' ').includes(token)?6:combined.includes(token)?3:0),0)+(title===words(query)?20:0);
    return {score,id:String(x.trackId),title:x.trackName.slice(0,300),artist:x.artistName.slice(0,300),album:String(x.collectionName||'').slice(0,300),year:String(x.releaseDate||'').slice(0,4),sourceUrl:`https://music.apple.com/us/song/${encodeURIComponent(x.trackId)}`,spotifyUrl:'https://open.spotify.com/search/'+encodeURIComponent(x.trackName+' '+x.artistName)};
  }).sort((a,b)=>b.score-a.score).filter(song=>{const key=words(song.title)+'|'+words(song.artist);if(seen.has(key))return false;seen.add(key);return true}).slice(0,8).map(({score,...song})=>song);
}
export function createSongSearch(fetcher=globalThis.fetch,{now=Date.now}={}){
  const cache=new Map(),pending=new Map();
  return async raw=>{
    const query=normalizeQuery(raw);if(query.length<2)return [];
    const key=query.toLowerCase(),entry=cache.get(key);if(entry&&entry.expires>now())return entry.results;
    if(pending.has(key))return pending.get(key);
    if(pending.size>=12)throw Object.assign(new Error('Song search is busy. Try again in a moment.'),{status:429});
    const task=(async()=>{
      const url=new URL('https://itunes.apple.com/search');url.search=new URLSearchParams({term:query,entity:'song',media:'music',country:'us',limit:'25'});
      let response;try{response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(7000)})}catch{throw new Error('Live song search could not connect. Check your connection and try again.')}
      if(!response.ok)throw Object.assign(new Error(response.status===429?'Song search is receiving too many requests. Please try again shortly.':'The song catalog is temporarily unavailable. Try again shortly.'),{status:response.status===429?429:502});
      let data;try{data=await response.json()}catch{throw new Error('The song catalog returned an unreadable response. Please try again.')}
      if(!Array.isArray(data.results))throw new Error('The song catalog returned an unreadable response. Please try again.');
      const results=rankSongs(data.results,query);if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{results,expires:now()+300000});return results;
    })();
    pending.set(key,task);try{return await task}finally{pending.delete(key)}
  };
}
