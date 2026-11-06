import http from 'node:http';
import {readFile} from 'node:fs/promises';
const allowed={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/music.js':'music.js','/guitar-audio.js':'guitar-audio.js','/tuner.js':'tuner.js','/charts.js':'charts.js','/charts-ui.js':'charts-ui.js','/sheet-reader.js':'sheet-reader.js','/reader-ui.js':'reader-ui.js','/score-config.js':'score-config.js','/favicon.svg':'favicon.svg','/favicon.png':'favicon.png','/favicon.ico':'favicon.ico','/apple-touch-icon.png':'apple-touch-icon.png'};
let scoreServicePromise;
async function scores(){scoreServicePromise??=import('./score-service.js').then(module=>module.createScoreService());return scoreServicePromise}
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body))}
const port=Number(process.env.PORT)||3000;
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/score')){
  const origin=req.headers.origin,allowedOrigins=(process.env.FRETMATE_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(origin){
   if(origin!=='http://'+req.headers.host&&origin!=='https://'+req.headers.host&&!allowedOrigins.includes(origin)){json(res,403,{error:'This website is not allowed to use the recognition backend.'});return}
   res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
   res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  }
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
  try{
   let service;try{service=await scores()}catch{json(res,url.pathname==='/api/score-capabilities'?200:503,{available:false,error:'Staff recognition needs server setup. Run npm install, then npm run setup:omr, and restart the server.',code:'OMR_SETUP'});return}
   if(url.pathname==='/api/score-capabilities'&&req.method==='GET'){json(res,200,await service.status());return}
   if(url.pathname==='/api/score'&&req.method==='POST'){
    const max=15*1024*1024;if(Number(req.headers['content-length'])>max){json(res,413,{error:'Use a photo under 15 MB.'});return}
    const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>max){json(res,413,{error:'Use a photo under 15 MB.'});return}chunks.push(chunk)}
    json(res,202,await service.submit(Buffer.concat(chunks),String(req.headers['content-type']||'').split(';')[0]));return;
   }
   const match=/^\/api\/score\/([a-f0-9-]{36})$/.exec(url.pathname);
   if(match&&req.method==='GET'){const job=service.get(match[1]);json(res,job?200:404,job||{error:'This recognition job expired. Upload the photo again.'});return}
   json(res,404,{error:'Not found'});return;
  }catch(error){json(res,error.status||500,{error:error.message||'The score could not be processed.',code:error.code||'SCORE_ERROR'});return}
 }
 const file=allowed[url.pathname];
 if(!file){res.writeHead(404);res.end('Not found');return}
 try{
  const body=await readFile(new URL(file,import.meta.url));
  res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.ico')?'image/x-icon':'text/html');res.end(body);
 }catch{res.writeHead(500);res.end('Unable to load page')}
});
server.on('error',error=>{
 if(error.code==='EADDRINUSE'){
  const next=port===65535?3000:port+1;
  console.error(`Port ${port} is already in use, possibly by an older copy of FretMate.
Stop the older server with Ctrl+C, or use another port.
Windows Command Prompt:
  set PORT=${next}
  npm start
Then open http://localhost:${next}`);
 }else console.error('FretMate could not start: '+error.message);
 process.exitCode=1;
});
server.listen(port,'0.0.0.0',()=>console.log('FretMate listening on port '+port));
