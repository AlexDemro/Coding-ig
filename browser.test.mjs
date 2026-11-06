import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile,readdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir=process.env.BROWSER_TEST_OUTPUT||await mkdtemp('/tmp/fretmate-browser-');await mkdir(dir,{recursive:true});
const browser=spawn(process.env.CHROMIUM_BIN||'/usr/bin/chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+dir+'/profile','about:blank'],{stdio:['ignore','ignore','pipe']});
let ws,sequence=0;const pending=new Map(),errors=[];
try{
 const endpoint=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(new Error('Browser startup timeout')),15000);browser.stderr.on('data',c=>{log+=c;const m=log.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1])}});browser.once('exit',code=>reject(new Error('Browser exited '+code)))});
 const base=endpoint.replace(/^ws:/,'http:').split('/devtools/')[0];
 const target=await (await fetch(base+'/json/new?about:blank',{method:'PUT'})).json();
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
 ws.onmessage=event=>{const data=JSON.parse(event.data);if(data.id){const result=pending.get(data.id);pending.delete(data.id);if(data.error)result?.reject(new Error(JSON.stringify(data.error)));else result?.resolve(data.result)}else if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails)};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
 const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value};
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*fonts.googleapis.com*','*fonts.gstatic.com*']});
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir+'/downloads'});
 await send('Emulation.setDeviceMetricsOverride',{width:1365,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:process.env.SITE_URL||'http://127.0.0.1:3001/'});
 for(let i=0;i<100;i++){if(await evaluate("document.readyState==='complete' && typeof document.getElementById('sheet-file')?.onchange==='function'"))break;await new Promise(r=>setTimeout(r,100))}
 assert.equal(await evaluate('document.title'),'FretMate — Find your rhythm');
 await evaluate("document.querySelector('[data-tab=\"tuner\"]').click()");
 assert.equal(await evaluate("document.querySelectorAll('[data-arc]').length"),13);
 // Feed a real Web Audio stream into the tuner. This checks the browser audio
 // graph and sampling loop, without claiming a physical microphone test.
 await evaluate(`navigator.mediaDevices.getUserMedia=async()=>{const context=new AudioContext();window.testAudio=context;const oscillator=context.createOscillator();oscillator.frequency.value=110;const destination=context.createMediaStreamDestination();oscillator.connect(destination);oscillator.start();await context.resume();return destination.stream};document.getElementById('mic').click()`);
 let liveNote='';for(let i=0;i<100;i++){liveNote=await evaluate("document.getElementById('pitch-note').textContent");if(liveNote==='A2')break;await new Promise(r=>setTimeout(r,70))}
 assert.equal(liveNote,'A2','real Web Audio pipeline detects A2');
 assert.ok(await evaluate("document.querySelectorAll('.arc-segments .lit').length>0"));
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(dir+'/tuner-desktop.png',Buffer.from(shot.data,'base64'));
 assert.equal(await evaluate("document.querySelectorAll('[data-tab=\"song-maker\"],[data-go=\"song-maker\"],#song-maker').length"),0);
 await evaluate("document.querySelector('[data-tab=\"reader\"]').click();window.testAudio.close()");
 assert.equal(await evaluate("document.querySelectorAll('#reader textarea,#reader pre,#reader code,#reader details').length"),0,'reader has no text editor or code output');
 assert.ok(await evaluate("document.querySelector('link[rel=icon]').href.endsWith('/favicon.svg')"));
 // Simulated OCR exercises photo selection through an actual PNG image export.
 await evaluate(`window.Tesseract={createWorker:async()=>({setParameters:async()=>{},recognize:async file=>{if(file.name==='bad.png')return {data:{text:'Only staff symbols, no chart'}};if(file.name==='slow.png')await new Promise(r=>setTimeout(r,600));return {data:{text:'G          C\\nAn original practice line\\nAm         D\\nAnother original line'}}},terminate:async()=>{}})};window.uploadPhoto=name=>{const transfer=new DataTransfer();transfer.items.add(new File(['test'],name,{type:'image/png'}));const input=document.getElementById('sheet-file');input.files=transfer.files;input.dispatchEvent(new Event('change'))};window.uploadPhoto('chart.png')`);
 for(let i=0;i<100;i++){if(await evaluate("document.querySelectorAll('#sheet-pages .chart-page').length>0"))break;await new Promise(r=>setTimeout(r,50))}
 assert.equal(await evaluate("document.querySelectorAll('#sheet-pages .chart-page').length"),1);
 assert.match(await evaluate("document.getElementById('read-status').textContent"),/image is ready/);
 assert.equal(await evaluate("fetch(document.querySelector('#sheet-pages img').src).then(r=>r.blob()).then(b=>b.type)"),'image/png');
 await evaluate("document.querySelector('#sheet-pages .chart-downloads a').click()");
 let downloads=[];for(let i=0;i<100;i++){try{downloads=await readdir(dir+'/downloads')}catch{}if(downloads.some(x=>x.endsWith('.png')))break;await new Promise(r=>setTimeout(r,100))}
 const file=downloads.find(x=>x.endsWith('.png'));assert.ok(file,'PNG file downloaded');const png=await readFile(dir+'/downloads/'+file);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1240);assert.equal(png.readUInt32BE(20),1754);
 const readerShot=await send('Page.captureScreenshot',{format:'png'});await writeFile(dir+'/photo-reader.png',Buffer.from(readerShot.data,'base64'));
 await evaluate("window.uploadPhoto('bad.png')");
 for(let i=0;i<100;i++){if(await evaluate("!document.getElementById('sheet-retry').hidden"))break;await new Promise(r=>setTimeout(r,50))}
 assert.equal(await evaluate("document.querySelectorAll('#sheet-pages .chart-page').length"),0,'unreadable photo clears old image');
 assert.match(await evaluate("document.getElementById('read-status').textContent"),/couldn’t find/);
 await evaluate("window.uploadPhoto('slow.png')");await new Promise(r=>setTimeout(r,70));await evaluate("window.uploadPhoto('chart.png')");
 await new Promise(r=>setTimeout(r,800));assert.equal(await evaluate("document.querySelectorAll('#sheet-pages .chart-page').length"),1,'replacing an in-flight photo cannot append stale images');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate("document.getElementById('menu-toggle').click()");
 assert.equal(await evaluate("document.getElementById('menu-toggle').getAttribute('aria-expanded')"),'true');
 assert.equal(await evaluate("getComputedStyle(document.getElementById('studio-navigation')).display"),'grid');
 await evaluate("document.querySelector('[data-tab=\"tuner\"]').click()");
 assert.equal(await evaluate("document.getElementById('menu-toggle').getAttribute('aria-expanded')"),'false');
 assert.ok(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'no mobile horizontal overflow');
 const mobile=await send('Page.captureScreenshot',{format:'png'});await writeFile(dir+'/tuner-mobile.png',Buffer.from(mobile.data,'base64'));
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log('Browser checks passed: song feature removed, FretMate branding, real Web Audio A2 detection and arc feedback, desktop/mobile navigation, upload-only photo reader, actual PNG preview/download (1240 × 1754), failed/new photo clears old results, favicon links, simulated photo-to-image pipeline.');
 console.log('Screenshots: '+dir+'/tuner-desktop.png; '+dir+'/tuner-mobile.png');
}finally{ws?.close();browser.kill('SIGTERM')}
