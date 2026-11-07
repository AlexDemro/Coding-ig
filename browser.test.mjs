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
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.testFetch=window.fetch;window.fetch=(url,options)=>String(url).includes('/api/score-capabilities')?Promise.resolve(new Response(JSON.stringify({available:false}),{headers:{'Content-Type':'application/json'}})):window.testFetch(url,options)`});
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
 assert.ok(await evaluate("new URL(document.querySelector('link[rel=icon]').href).pathname==='/favicon.svg'"));
 assert.equal(await evaluate("document.querySelector('.brand-mark').src===document.querySelector('link[rel=icon]').href"),true,'browser tab and site header use exactly the same logo asset');
 // Simulated OCR exercises photo selection through an actual PNG image export.
 await evaluate(`window.Tesseract={createWorker:async(lang,mode,options)=>({setParameters:async()=>{},recognize:async file=>{options.logger({status:'recognizing text',progress:.5});if(file.name==='bad.png')return {data:{text:'Only staff symbols, no chart'}};if(file.name==='slow.png')await new Promise(r=>setTimeout(r,600));return {data:{text:'G          C\\nAn original practice line\\nAm         D\\nAnother original line'}}},terminate:async()=>{}})};window.uploadPhoto=name=>{const transfer=new DataTransfer();transfer.items.add(new File(['test'],name,{type:'image/png'}));const input=document.getElementById('sheet-file');input.files=transfer.files;input.dispatchEvent(new Event('change'))};window.uploadPhoto('chart.png')`);
 for(let i=0;i<100;i++){if(await evaluate("document.querySelectorAll('#sheet-pages .chart-page').length>0"))break;await new Promise(r=>setTimeout(r,50))}
 assert.equal(await evaluate("document.querySelectorAll('#sheet-pages .chart-page').length"),1);
 assert.equal(await evaluate("Array.from(document.fonts).some(f=>f.family==='FretMate Chart'&&f.status==='loaded')"),true,'export uses the bundled Inter font');
 assert.match(await evaluate("document.getElementById('read-status').textContent"),/image is ready/);
 assert.equal(await evaluate("fetch(document.querySelector('#sheet-pages img').src).then(r=>r.blob()).then(b=>b.type)"),'image/png');
 await evaluate("document.querySelector('#sheet-pages .chart-downloads a').click()");
 let downloads=[];for(let i=0;i<100;i++){try{downloads=await readdir(dir+'/downloads')}catch{}if(downloads.some(x=>x.endsWith('.png')))break;await new Promise(r=>setTimeout(r,100))}
 const file=downloads.find(x=>x.endsWith('.png'));assert.ok(file,'PNG file downloaded');const png=await readFile(dir+'/downloads/'+file);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1240);assert.equal(png.readUInt32BE(20),1754);
 const readerShot=await send('Page.captureScreenshot',{format:'png'});await writeFile(dir+'/photo-reader.png',Buffer.from(readerShot.data,'base64'));
 await evaluate("window.uploadPhoto('bad.png')");
 for(let i=0;i<100;i++){if(await evaluate("!document.getElementById('sheet-retry').hidden"))break;await new Promise(r=>setTimeout(r,50))}
 assert.equal(await evaluate("document.querySelectorAll('#sheet-pages .chart-page').length"),0,'unreadable photo clears old image');
 assert.match(await evaluate("document.getElementById('read-status').textContent"),/Staff-note recognition is not enabled/);
 await evaluate("window.uploadPhoto('slow.png')");await new Promise(r=>setTimeout(r,70));
 assert.equal(await evaluate("document.getElementById('sheet-progress').hidden"),false);
 assert.equal(await evaluate("document.getElementById('sheet-progress').getAttribute('aria-valuenow')"),'45');
 assert.equal(await evaluate("document.getElementById('sheet-progress-label').textContent"),'45%');
 assert.equal(await evaluate("document.querySelectorAll('#sheet-progress svg circle').length"),2,'circular progress replaces the line');
 const progressShot=await send('Page.captureScreenshot',{format:'png'});await writeFile(dir+'/reader-progress.png',Buffer.from(progressShot.data,'base64'));
 await evaluate("window.uploadPhoto('chart.png')");
 await new Promise(r=>setTimeout(r,800));assert.equal(await evaluate("document.querySelectorAll('#sheet-pages .chart-page').length"),1,'replacing an in-flight photo cannot append stale images');
 // Native-recognition response is a fixture here; a separate HTTP test runs Audiveris itself.
 await evaluate(`window.fetch=(url,options)=>{const target=String(url);if(target.includes('/api/score-capabilities'))return Promise.resolve(new Response(JSON.stringify({available:true})));if(target.endsWith('/api/score'))return Promise.resolve(new Response(JSON.stringify({id:'fixture-score'}),{status:202}));if(target.includes('/api/score/fixture-score'))return Promise.resolve(new Response(JSON.stringify({state:'done',result:{title:'Instrumental test',subtitle:'Instrumental chord guide · no lyrics in score',lyrical:false,rows:[{lyrics:'Measure 1',chords:[],section:true},{lyrics:'beat 1      beat 2',chords:[{text:'G',column:0},{text:'D',column:12}]}]}})));return window.testFetch(url,options)};window.uploadPhoto('score.png')`);
 for(let i=0;i<100;i++){if(await evaluate("document.getElementById('read-status').textContent.includes('Instrumental chord guide ready')"))break;await new Promise(r=>setTimeout(r,50))}
 assert.match(await evaluate("document.getElementById('read-status').textContent"),/Instrumental chord guide ready/);
 assert.equal(await evaluate("document.querySelectorAll('#sheet-pages img').length"),1,'instrumental notation produces an image without invented lyrics');
 await evaluate(`window.Tesseract.createWorker=async()=>{throw Error('Unreliable staff recognition must not fall through into printed-chart OCR')};window.fetch=(url,options)=>{const target=String(url);if(target.includes('/api/score-capabilities'))return Promise.resolve(new Response(JSON.stringify({available:true})));if(target.endsWith('/api/score'))return Promise.resolve(new Response(JSON.stringify({id:'fixture-score'}),{status:202}));if(target.includes('/api/score/fixture-score'))return Promise.resolve(new Response(JSON.stringify({state:'error',code:'UNRELIABLE_SCORE',message:'The recognized notes and lyric syllables are too uncertain. Try a clearer scan.'})));return window.testFetch(url,options)};window.uploadPhoto('uncertain.png')`);
 for(let i=0;i<100;i++){if(await evaluate("!document.getElementById('sheet-retry').hidden"))break;await new Promise(r=>setTimeout(r,50))}
 assert.equal(await evaluate("document.querySelectorAll('#sheet-pages img').length"),0,'uncertain recognition does not export a misleading image');
 assert.match(await evaluate("document.getElementById('read-status').textContent"),/too uncertain/);
 assert.equal(await evaluate("document.getElementById('sheet-progress').hidden"),true);
 // Real audio nodes and the editable grid, including persistence and silence.
 await evaluate("document.querySelector('[data-tab=\"strumming\"]').click()");
 assert.equal(await evaluate("document.querySelectorAll('#strum-grid .stroke-button').length"),8);
 await evaluate("document.querySelector('#strum-grid [data-step=\"0\"]').click()");
 assert.equal(await evaluate("document.querySelector('#strum-grid [data-step=\"0\"]').textContent"),'↑');
 await evaluate("document.querySelector('#strum-grid [data-accent=\"0\"]').click()");
 assert.equal(await evaluate("document.querySelector('#strum-grid [data-accent=\"0\"]').getAttribute('aria-pressed')"),'false');
 await evaluate("document.getElementById('strum-subdivision').value='4';document.getElementById('strum-subdivision').dispatchEvent(new Event('change'));document.getElementById('strum-swing').value='63';document.getElementById('strum-swing').dispatchEvent(new Event('input'))");
 assert.equal(await evaluate("document.querySelectorAll('#strum-grid .stroke-button').length"),16);
 assert.equal(await evaluate("JSON.parse(localStorage.getItem('fretmate-strumming-v1')).swing"),63);
 await evaluate("document.getElementById('strum-play').click()");for(let i=0;i<100;i++){if(await evaluate("document.getElementById('strum-play').textContent==='Stop pattern'"))break;await new Promise(r=>setTimeout(r,50))}await new Promise(r=>setTimeout(r,100));
 assert.equal(await evaluate("document.getElementById('strum-play').textContent"),'Stop pattern');
 assert.equal(await evaluate("document.getElementById('strum-audio-status').textContent"),'Acoustic guitar tone','bundled guitar samples loaded and decoded');
 assert.equal(await evaluate("document.querySelectorAll('#strum-grid .on').length"),1);
 const strumShot=await send('Page.captureScreenshot',{format:'png'});await writeFile(dir+'/strumming-desktop.png',Buffer.from(strumShot.data,'base64'));
 await evaluate("document.querySelector('[data-tab=\"chords\"]').click()");
 assert.equal(await evaluate("document.getElementById('strum-play').textContent"),'Play pattern');
 await evaluate("document.querySelector('[data-tab=\"strumming\"]').click();document.getElementById('strum-clear').click();document.getElementById('strum-play').click()");
 assert.match(await evaluate("document.getElementById('pattern-description').textContent"),/Add a downstroke/);
 const audioResult=await evaluate(`(async()=>{const {createGuitar,loadGuitarSamples}=await import('./guitar-audio.js');const ctx=new OfflineAudioContext(2,96000,48000);const samples=await loadGuitarSamples(ctx);if(!samples)throw Error('Sample decode failed');const guitar=createGuitar(ctx,samples);guitar.strum(.05,'G',false,{feel:0,volume:1});guitar.strum(.55,'G',true,{feel:.6,volume:1});guitar.strum(1.05,'D',false,{feel:.6,volume:1,accent:true});const buffer=await ctx.startRendering();let peak=0,energy=0;for(const sample of buffer.getChannelData(0)){peak=Math.max(peak,Math.abs(sample));energy+=sample*sample}return {peak,rms:Math.sqrt(energy/buffer.length)}})()`);
 assert.ok(audioResult.rms>.005,'real audio graph produces audible guitar signal');assert.ok(audioResult.peak<.99,'guitar output has headroom');console.log('Rendered guitar output:',audioResult);
 await send('Network.setBlockedURLs',{urls:['*fonts.googleapis.com*','*fonts.gstatic.com*','*sounds/guitar/*']});
 const fallback=await evaluate(`(async()=>{const {createGuitar,loadGuitarSamples}=await import('./guitar-audio.js');const ctx=new OfflineAudioContext(2,48000,48000);const samples=await loadGuitarSamples(ctx);const guitar=createGuitar(ctx,samples);guitar.strum(.02,'G',false);const buffer=await ctx.startRendering();let energy=0;for(const n of buffer.getChannelData(0))energy+=n*n;return {usedFallback:samples===null,rms:Math.sqrt(energy/buffer.length)}})()`);
 assert.equal(fallback.usedFallback,true);assert.ok(fallback.rms>.005,'failed samples retain an audible synthesized guitar fallback');
 await send('Network.setBlockedURLs',{urls:['*fonts.googleapis.com*','*fonts.gstatic.com*']});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate("document.getElementById('menu-toggle').click()");
 assert.equal(await evaluate("document.getElementById('menu-toggle').getAttribute('aria-expanded')"),'true');
 assert.equal(await evaluate("getComputedStyle(document.getElementById('studio-navigation')).display"),'grid');
 await evaluate("document.querySelector('[data-tab=\"tuner\"]').click()");
 assert.equal(await evaluate("document.getElementById('menu-toggle').getAttribute('aria-expanded')"),'false');
 assert.ok(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'no mobile horizontal overflow');
 const mobile=await send('Page.captureScreenshot',{format:'png'});await writeFile(dir+'/tuner-mobile.png',Buffer.from(mobile.data,'base64'));
 await evaluate("document.querySelector('[data-tab=\"strumming\"]').click();document.getElementById('strum-reset').click();document.querySelector('#strum-grid [data-step=\"0\"]').click()");
 assert.ok(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'custom pattern has no mobile horizontal overflow');
 const strumMobile=await send('Page.captureScreenshot',{format:'png'});await writeFile(dir+'/strumming-mobile.png',Buffer.from(strumMobile.data,'base64'));
 await send('Page.reload');
 for(let i=0;i<100;i++){if(await evaluate("typeof document.getElementById('strum-play')?.onclick==='function'"))break;await new Promise(r=>setTimeout(r,50))}
 assert.equal(await evaluate("document.querySelector('#strum-grid [data-step=\"0\"]').textContent"),'↑','custom edits survive reloading');
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log('Browser checks passed: tuner, navigation, branding, Inter PNG preview/download, circular progress, unreliable recognition rejection, editable strumming strokes/accents/grid/swing, persistence, real guitar audio rendering, audio stop on navigation, desktop/mobile layouts. OCR/native API responses are fixtures.');
 console.log('Screenshots: '+dir+'/tuner-desktop.png; '+dir+'/tuner-mobile.png');
}finally{ws?.close();browser.kill('SIGTERM')}
