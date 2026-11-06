import http from 'node:http';
import {readFile} from 'node:fs/promises';
const allowed={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/music.js':'music.js','/guitar-audio.js':'guitar-audio.js','/tuner.js':'tuner.js','/charts.js':'charts.js','/charts-ui.js':'charts-ui.js','/sheet-reader.js':'sheet-reader.js','/reader-ui.js':'reader-ui.js','/favicon.svg':'favicon.svg','/favicon.png':'favicon.png','/favicon.ico':'favicon.ico','/apple-touch-icon.png':'apple-touch-icon.png'};
const port=Number(process.env.PORT)||3000;
const server=http.createServer(async(req,res)=>{
 const file=allowed[new URL(req.url,'http://localhost').pathname];
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
