import {layoutChart,chartSummary} from './charts.js';
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const issue=(message,status)=>Object.assign(new Error(message),{status});
function artistNames(song){
 const entries=[song.artist,...(Array.isArray(song.artists)?song.artists:[]),...(Array.isArray(song.performers)?song.performers:[])];
 return entries.flatMap(entry=>typeof entry==='string'?[entry]:entry&&typeof entry==='object'?[entry.name,entry.artist?.name].filter(x=>typeof x==='string'):[]);
}
export function createGuitarPartySource({key=process.env.GUITARPARTY_API_KEY,fetcher=globalThis.fetch}={}){
 async function request(path){
  let response;
  try{response=await fetcher('https://api.guitarparty.com/v2/'+path,{headers:{Accept:'application/json','Guitarparty-Api-Key':key},signal:AbortSignal.timeout(12000),redirect:'error'})}
  catch{throw issue('Could not reach GuitarParty. Check the server connection and allowed network destinations.',502)}
  if(response.status===401)throw issue('GuitarParty could not authenticate this API key. Check the saved GuitarParty credential.',503);
  if(response.status===403)throw issue('GuitarParty access was denied. Check your account access and server network settings.',503);
  if(response.status===404)throw issue('This song chart is no longer available from GuitarParty.',404);
  if(response.status===429)throw issue('GuitarParty is receiving too many requests. Try again shortly.',429);
  if(!response.ok)throw issue('GuitarParty is temporarily unavailable. Try again shortly.',502);
  const body=await response.text();if(body.length>500000)throw issue('GuitarParty returned an oversized response.',502);
  try{return JSON.parse(body)}catch{throw issue('GuitarParty returned an unreadable response.',502)}
 }
 return async({title,artist})=>{
  if(!key)throw issue('Connect a GuitarParty API key in the server settings to load song charts automatically.',503);
  if(typeof title!=='string'||!title.trim()||title.length>300||typeof artist!=='string'||!artist.trim()||artist.length>300)throw issue('Select a song with a title and artist first.',400);
  const data=await request('songs/?'+new URLSearchParams({query:title}));
  if(!Array.isArray(data.objects))throw issue('The GuitarParty song list has an unsupported format.',502);
  const candidates=data.objects.filter(song=>normalize(song.title)===normalize(title)&&/^\d+$/.test(String(song.id))).slice(0,3);
  for(const candidate of candidates){
   const song=await request('songs/'+encodeURIComponent(candidate.id)+'/');
   if(normalize(song.title)!==normalize(title)||!artistNames(song).some(name=>normalize(name)===normalize(artist)))continue;
   if(typeof song.body!=='string'||song.body.length>40000||/<\/?[a-z][^>]*>/i.test(song.body))throw issue('This GuitarParty chart does not include a supported plain-text lyric-and-chord body.',502);
   const summary=chartSummary(layoutChart(song.body));
   if(!summary.lyrics||!summary.chords)throw issue('This GuitarParty chart does not contain both lyrics and positioned chords.',404);
   return {title,artist,chart:song.body};
  }
  throw issue('GuitarParty did not return a matching chart for '+title+' by '+artist+'. Its catalog does not contain every song.',404);
 };
}
