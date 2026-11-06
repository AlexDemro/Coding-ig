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
 for(let i=0;i<100;i++){if(await evaluate("document.readyState==='complete' && typeof document.getElementById('song-generate')?.onclick==='function'"))break;await new Promise(r=>setTimeout(r,100))}
 assert.equal(await evaluate('document.title'),'FretMate.app — Find your rhythm');
 await evaluate("document.querySelector('[data-tab=\"tuner\"]').click()");
 assert.equal(await evaluate("document.querySelectorAll('[data-arc]').length"),13);
 // Feed a real Web Audio stream into the tuner. This checks the browser audio
 // graph and sampling loop, without claiming a physical microphone test.
 await evaluate(`navigator.mediaDevices.getUserMedia=async()=>{const context=new AudioContext();window.testAudio=context;const oscillator=context.createOscillator();oscillator.frequency.value=110;const destination=context.createMediaStreamDestination();oscillator.connect(destination);oscillator.start();await context.resume();return destination.stream};document.getElementById('mic').click()`);
 let liveNote='';for(let i=0;i<100;i++){liveNote=await evaluate("document.getElementById('pitch-note').textContent");if(liveNote==='A2')break;await new Promise(r=>setTimeout(r,70))}
 assert.equal(liveNote,'A2','real Web Audio pipeline detects A2');
 assert.ok(await evaluate("document.querySelectorAll('.arc-segments .lit').length>0"));
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(dir+'/tuner-desktop.png',Buffer.from(shot.data,'base64'));
 await evaluate("document.querySelector('[data-tab=\"song-maker\"]').click();document.getElementById('song-example').click();document.getElementById('song-generate').click()");
 await evaluate("window.testAudio.close()");
 assert.equal(await evaluate("document.querySelectorAll('#song-pages .chart-page').length"),1);
 assert.match(await evaluate("document.getElementById('song-chart-status').textContent"),/image ready/);
 await evaluate("new Promise((resolve,reject)=>{const img=document.querySelector('#song-pages img');if(img.complete&&img.naturalWidth)resolve();else {img.onload=resolve;img.onerror=reject}})");
 await evaluate("document.querySelector('#song-pages .chart-downloads .primary').click()");
 let downloads=[];for(let i=0;i<100;i++){try{downloads=await readdir(dir+'/downloads')}catch{}if(downloads.some(x=>x.endsWith('.png')))break;await new Promise(r=>setTimeout(r,100))}
 const file=downloads.find(x=>x.endsWith('.png'));assert.ok(file,'PNG file downloaded');const png=await readFile(dir+'/downloads/'+file);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1240);assert.equal(png.readUInt32BE(20),1754);
 await evaluate("document.getElementById('song-title').value='Changed';document.getElementById('song-title').dispatchEvent(new Event('input'))");
 assert.equal(await evaluate("document.querySelectorAll('#song-pages .chart-page').length"),0);
 // Autocomplete uses a deterministic catalog response; outbound catalog
 // access is checked separately and may be restricted by the environment.
 await evaluate(`window.originalFetch=window.fetch;window.songRequests=[];window.fetch=async(url,options)=>{if(String(url).startsWith('/api/songs?')){const query=new URL(url,location.origin).searchParams.get('q');window.songRequests.push(query);if(query==='fail')return {ok:false,json:async()=>({error:'Catalog temporarily unavailable'})};if(query==='nothing')return {ok:true,json:async()=>({results:[]})};const result={id:'2',title:'Dracula',artist:'Tame Impala',album:'Test album',spotifyUrl:'https://open.spotify.com/search/Dracula%20Tame%20Impala'};if(query==='slow')await new Promise(r=>setTimeout(r,1000));return {ok:true,json:async()=>({results:[{...result,title:query==='slow'?'Old result':'Dracula'}]})}}return window.originalFetch(url,options)};document.querySelector('[data-tab="song-maker"]').click();const search=document.getElementById('song-search');search.value='D';search.dispatchEvent(new Event('input'))`);
 await new Promise(r=>setTimeout(r,450));assert.equal(await evaluate('window.songRequests.length'),0);
 await evaluate("{const input=document.getElementById('song-search');input.focus();for(const q of ['Dr','Dra','Dracula Tame Impala']){input.value=q;input.dispatchEvent(new Event('input'))}}");
 for(let i=0;i<40;i++){if(await evaluate("document.getElementById('song-search').getAttribute('aria-expanded')==='true'"))break;await new Promise(r=>setTimeout(r,50))}
 assert.equal(await evaluate('window.songRequests.length'),1,'debounced rapid keystrokes');
 assert.match(await evaluate("document.getElementById('song-suggestions').textContent"),/Dracula.*Tame Impala/);
 const autocomplete=await send('Page.captureScreenshot',{format:'png'});await writeFile(dir+'/song-autocomplete.png',Buffer.from(autocomplete.data,'base64'));
 await evaluate("{const input=document.getElementById('song-search');input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))}");
 assert.equal(await evaluate("document.getElementById('song-title').value"),'Dracula');assert.equal(await evaluate("document.getElementById('song-artist').value"),'Tame Impala');
 assert.equal(await evaluate("document.getElementById('selected-song').hidden"),false);
 assert.match(await evaluate("document.getElementById('selected-song-spotify').href"),/open.spotify.com/);
 await evaluate("{document.getElementById('change-song').click();const input=document.getElementById('song-search');input.value='slow';input.dispatchEvent(new Event('input'))}");
 await new Promise(r=>setTimeout(r,400));
 await evaluate("{const input=document.getElementById('song-search');input.value='Dracula';input.dispatchEvent(new Event('input'))}");
 await new Promise(r=>setTimeout(r,1200));
 assert.ok(!await evaluate("document.getElementById('song-suggestions').textContent.includes('Old result')"),'late response cannot replace latest results');
 await evaluate("{const input=document.getElementById('song-search');input.value='nothing';input.dispatchEvent(new Event('input'))}");await new Promise(r=>setTimeout(r,500));assert.match(await evaluate("document.getElementById('song-search-status').textContent"),/No matches/);
 await evaluate("{const input=document.getElementById('song-search');input.value='fail';input.dispatchEvent(new Event('input'))}");await new Promise(r=>setTimeout(r,500));assert.match(await evaluate("document.getElementById('song-search-status').textContent"),/unavailable/);
 await evaluate('window.fetch=window.originalFetch');
 // Photo OCR is simulated to test the application pipeline, not the external OCR model.
 await evaluate(`window.Tesseract={createWorker:async()=>({setParameters:async()=>{},recognize:async()=>({data:{text:'G          C\\nAn original practice line\\nAm         D\\nAnother original line'}}),terminate:async()=>{}})};document.querySelector('[data-tab="reader"]').click();const transfer=new DataTransfer();transfer.items.add(new File(['test'],'chart.png',{type:'image/png'}));const input=document.getElementById('sheet-file');input.files=transfer.files;input.dispatchEvent(new Event('change'));document.getElementById('read-sheet').click()`);
 for(let i=0;i<100;i++){if(await evaluate("document.querySelectorAll('#sheet-pages .chart-page').length>0"))break;await new Promise(r=>setTimeout(r,50))}
 assert.equal(await evaluate("document.querySelectorAll('#sheet-pages .chart-page').length"),1);
 assert.match(await evaluate("document.getElementById('sheet-text').value"),/original practice/);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate("document.getElementById('menu-toggle').click()");
 assert.equal(await evaluate("document.getElementById('menu-toggle').getAttribute('aria-expanded')"),'true');
 assert.equal(await evaluate("getComputedStyle(document.getElementById('studio-navigation')).display"),'grid');
 await evaluate("document.querySelector('[data-tab=\"tuner\"]').click()");
 assert.equal(await evaluate("document.getElementById('menu-toggle').getAttribute('aria-expanded')"),'false');
 assert.ok(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'no mobile horizontal overflow');
 const mobile=await send('Page.captureScreenshot',{format:'png'});await writeFile(dir+'/tuner-mobile.png',Buffer.from(mobile.data,'base64'));
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log('Browser checks passed: autocomplete debounce/selection/errors/stale-response handling (mock catalog), real Web Audio A2 detection and arc feedback, desktop/mobile navigation, 13-segment tuner, chart preview, real PNG download (1240 × 1754), edit invalidation, simulated photo-to-chart pipeline.');
 console.log('Screenshots: '+dir+'/tuner-desktop.png; '+dir+'/tuner-mobile.png');
}finally{ws?.close();browser.kill('SIGTERM')}
