import {layoutChart,chartSummary} from './charts.js';
const normalized=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const problem=(message,status)=>Object.assign(new Error(message),{status});
// Adapter for a server-configured, authorized chart source. No title-to-chords
// inference, scraping, or generated lyrics take place in this adapter.
export function createChartSource({endpoint=process.env.SONG_CHART_ENDPOINT,token=process.env.SONG_CHART_TOKEN,fetcher=globalThis.fetch}={}){
 return async({title,artist,id})=>{
  if(typeof title!=='string'||!title.trim()||title.length>300||typeof artist!=='string'||!artist.trim()||artist.length>300)throw problem('Choose a song with a title and artist first.',400);
  if(!endpoint)throw problem('Automatic chart generation is not connected yet. A source containing the song’s lyrics and correctly placed chords is required.',503);
  let url;try{url=new URL(endpoint);if(url.protocol!=='https:'||url.username||url.password)throw Error()}catch{throw problem('The chart source configuration is invalid.',503)}
  url.searchParams.set('title',title);url.searchParams.set('artist',artist);if(id)url.searchParams.set('id',String(id).slice(0,120));
  let response;try{response=await fetcher(url,{signal:AbortSignal.timeout(15000),headers:{Accept:'application/json',...(token?{Authorization:'Bearer '+token}:{})},redirect:'error'})}catch{throw problem('The chart source could not be reached. Please try again.',502)}
  if(response.status===404)throw problem('A complete lyric-and-chord chart was not found for this song.',404);
  if(!response.ok)throw problem('The chart source is unavailable. Please try again.',502);
  const text=await response.text();if(text.length>100000)throw problem('The chart source returned an oversized response.',502);
  let chart;try{chart=JSON.parse(text)}catch{throw problem('The chart source returned an unreadable chart.',502)}
  if(typeof chart.title!=='string'||typeof chart.artist!=='string'||normalized(chart.title)!==normalized(title)||normalized(chart.artist)!==normalized(artist))throw problem('The returned chart does not match the selected song.',502);
  if(typeof chart.chart!=='string'||chart.chart.length>40000)throw problem('The chart source did not return a usable chart.',502);
  const summary=chartSummary(layoutChart(chart.chart));
  if(!summary.lyrics||!summary.chords)throw problem('The chart source must include both lyrics and positioned chords.',502);
  return {title,artist,chart:chart.chart};
 };
}
