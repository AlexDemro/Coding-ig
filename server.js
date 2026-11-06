import http from 'node:http';
import {createSongSearch} from './song-search.js';
import {createChartSource} from './chart-source.js';
const loadChart=createChartSource();
http.setGlobalProxyFromEnv?.();
const searchSongs=createSongSearch();
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('./',import.meta.url);
const allowed={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/music.js':'music.js','/guitar-audio.js':'guitar-audio.js','/tuner.js':'tuner.js','/charts.js':'charts.js','/charts-ui.js':'charts-ui.js','/song-picker.js':'song-picker.js'};
http.createServer(async(req,res)=>{
const url=new URL(req.url,'http://localhost');
if(url.pathname==='/api/song-chart'){
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.writeHead(405,{Allow:'GET'});res.end(JSON.stringify({error:'Use GET for chart generation.'}));return}
  try{res.end(JSON.stringify(await loadChart({title:url.searchParams.get('title'),artist:url.searchParams.get('artist'),id:url.searchParams.get('id')})))}
  catch(error){res.writeHead(error.status||502);res.end(JSON.stringify({error:error.message}))}return;
}
if(url.pathname==='/api/songs'){
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.writeHead(405,{Allow:'GET'});res.end(JSON.stringify({error:'Use GET for song search.'}));return}
  try{const results=await searchSongs(url.searchParams.get('q'));res.end(JSON.stringify({results}))}
  catch(error){res.writeHead(error.status||502);res.end(JSON.stringify({error:error.message}))}return;
}
const file=allowed[url.pathname];if(!file){res.writeHead(404);res.end('Not found');return}try{const body=await readFile(fileURLToPath(new URL(file,root)));res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html');res.end(body)}catch{res.writeHead(500);res.end('Unable to load page')}}).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('FretMate.app listening on port '+(process.env.PORT||3000)));
