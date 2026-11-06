import http from 'node:http';
import {readFile} from 'node:fs/promises';
const allowed={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/music.js':'music.js','/guitar-audio.js':'guitar-audio.js','/tuner.js':'tuner.js','/charts.js':'charts.js','/charts-ui.js':'charts-ui.js'};
http.createServer(async(req,res)=>{
 const file=allowed[new URL(req.url,'http://localhost').pathname];
 if(!file){res.writeHead(404);res.end('Not found');return}
 try{
  const body=await readFile(new URL(file,import.meta.url));
  res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html');res.end(body);
 }catch{res.writeHead(500);res.end('Unable to load page')}
}).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('FretMate listening on port '+(process.env.PORT||3000)));
