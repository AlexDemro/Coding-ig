import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('./',import.meta.url);
const allowed={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/music.js':'music.js','/guitar-audio.js':'guitar-audio.js'};
http.createServer(async(req,res)=>{const file=allowed[new URL(req.url,'http://localhost').pathname];if(!file){res.writeHead(404);res.end('Not found');return}try{const body=await readFile(fileURLToPath(new URL(file,root)));res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html');res.end(body)}catch{res.writeHead(500);res.end('Unable to load page')}}).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Fret & Flow listening on port '+(process.env.PORT||3000)));
