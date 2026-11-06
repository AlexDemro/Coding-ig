import {createGuitar} from './guitar-audio.js';
import {notes,transpose,extractChords,detectPitch} from './music.js';
const $=id=>document.getElementById(id);let stopMic=()=>{},stopMetro=()=>{},stopStrum=()=>{};
function navigate(tab){stopMic();stopMetro();stopStrum();document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===tab));document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));$('page-name').textContent=document.querySelector(`[data-tab="${tab}"] span`).textContent;window.scrollTo(0,0)}
document.querySelectorAll('[data-tab],[data-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.tab||b.dataset.go));
const shapes={C:[-1,3,2,0,1,0],D:[-1,-1,0,2,3,2],E:[0,2,2,1,0,0],F:[1,3,3,2,1,1],G:[3,2,0,0,0,3],A:[-1,0,2,2,2,0],B:[-1,2,4,4,4,2],Am:[-1,0,2,2,1,0],Dm:[-1,-1,0,2,3,1],Em:[0,2,2,0,0,0],Bm:[-1,2,4,4,3,2],C7:[-1,3,2,3,1,0],D7:[-1,-1,0,2,1,2],E7:[0,2,0,1,0,0],G7:[3,2,0,0,0,1],A7:[-1,0,2,0,2,0]};
function diagram(frets){let s='<svg viewBox="0 0 140 160" role="img" aria-label="Guitar chord fingering"><path d="M25 30H115" stroke="#344b37" stroke-width="4"/>';for(let i=0;i<6;i++)s+=`<path d="M${25+i*18} 30V130" stroke="#a8b29c"/>`;for(let i=1;i<=5;i++)s+=`<path d="M25 ${30+i*20}H115" stroke="#a8b29c"/>`;frets.forEach((f,i)=>{s+=f>0?`<circle cx="${25+i*18}" cy="${20+f*20}" r="7" fill="#36543b"/>`:`<text x="${25+i*18}" y="20" text-anchor="middle" font-size="13" fill="#8c997d">${f<0?'×':'○'}</text>`;s+=`<text x="${25+i*18}" y="148" text-anchor="middle" font-size="9" fill="#8c997d">${'EADGBe'[i]}</text>`});return s+'</svg>'}
function renderChords(){const query=$('chord-search').value.trim().toLowerCase(),family=$('chord-family').value;const entries=Object.entries(shapes).filter(([name])=>name.toLowerCase().includes(query)&&(family==='all'||(family==='minor'?name.endsWith('m'):family==='seventh'?name.endsWith('7'):!/[m7]/.test(name))));$('chord-list').innerHTML=entries.length?entries.map(([name,frets])=>`<article class="chord-card"><h2>${name}</h2>${diagram(frets)}<p>${frets.map(f=>f<0?'×':f).join(' · ')}${['F','B','Bm'].includes(name)?' · Barre chord':''}</p></article>`).join(''):'<p>No matching shapes. Try C, Am, or G7.</p>'}
$('chord-search').oninput=renderChords;$('chord-family').onchange=renderChords;renderChords();
for(let i=0;i<=12;i++)$('capo-fret').add(new Option(i===0?'No capo':`Fret ${i}`,i));
function showChords(id,chords){$(id).replaceChildren(...chords.map(c=>{let el=document.createElement('span');el.textContent=c;return el}))}
function convert(){let input=$('capo-input').value.trim().split(/\s+/).filter(Boolean),valid=extractChords(input.join(' '));if(valid.length!==input.length){$('capo-output').textContent='Use chord names such as C, F#m, Bb7, or D/F#.';return}showChords('capo-output',valid.map(c=>transpose(c,Number($('capo-fret').value)*Number($('capo-mode').value))))}
['capo-fret','capo-mode','capo-input'].forEach(id=>$(id).addEventListener('input',convert));convert();
let audio;
function prepareAudio(){
  const AudioEngine=window.AudioContext||window.webkitAudioContext;
  if(!AudioEngine)throw new Error('Your browser does not support audio. Try a current version of Chrome, Edge, Firefox, or Safari.');
  audio??=new AudioEngine();
  return audio;
}
async function getAudio(){const ctx=prepareAudio();if(ctx.state!=='running')await ctx.resume();return ctx}
let guitar;

function clickAt(ctx,time,accent=true){const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=accent?1100:750;gain.gain.setValueAtTime(.15,time);gain.gain.exponentialRampToValueAtTime(.001,time+.055);osc.connect(gain);gain.connect(ctx.destination);osc.start(time);osc.stop(time+.06)}
let metroRunning=false,metroTimer,metroBeat=0,nextBeat=0;
function dots(){ $('beat-dots').innerHTML=Array.from({length:Number($('beats').value)},()=>'<i></i>').join('') }dots();
$('bpm').oninput=()=>$('bpm-value').textContent=$('bpm').value;
$('beats').onchange=()=>{metroBeat=0;dots()};
stopMetro=()=>{metroRunning=false;clearInterval(metroTimer);$('metro-toggle').textContent='Start metronome';document.querySelectorAll('#beat-dots i').forEach(x=>x.classList.remove('on'))};
$('metro-toggle').onclick=async()=>{if(metroRunning){stopMetro();return}try{const ctx=await getAudio();metroRunning=true;metroBeat=0;nextBeat=ctx.currentTime+.04;$('metro-toggle').textContent='Stop metronome';metroTimer=setInterval(()=>{while(nextBeat<ctx.currentTime+.1){const beat=metroBeat%Number($('beats').value);clickAt(ctx,nextBeat,beat===0);const delay=Math.max(0,(nextBeat-ctx.currentTime)*1000);setTimeout(()=>{if(metroRunning)document.querySelectorAll('#beat-dots i').forEach((x,i)=>x.classList.toggle('on',i===beat))},delay);nextBeat+=60/Number($('bpm').value);metroBeat++}},25)}catch{ $('metro-toggle').textContent='Audio unavailable — try again' }};
let taps=[];$('tap').onclick=()=>{const now=performance.now();if(taps.length&&now-taps.at(-1)>2500)taps=[];taps.push(now);taps=taps.slice(-5);if(taps.length>1){$('bpm').value=Math.round(60000/((now-taps[0])/(taps.length-1)));$('bpm').oninput()}};
const patterns=[{steps:['↓','·','↓','·','↓','·','↓','·'],description:'One downstroke on each beat. Relax your wrist and keep an even pulse.'},{steps:['↓','·','↓','↑','·','↑','↓','↑'],description:'The classic down, down-up, up-down-up. Let your hand keep swinging on beat three.'},{steps:['↓','↑','↓','↑','↓','↑','↓','↑'],description:'Even eighth notes. Keep the upstrokes light and accent the downbeats.'},{steps:['·','↑','·','↑','·','↑','·','↑'],description:'Play the “and” of each beat. Keep each upstroke crisp and short.'}];
function renderPattern(){const p=patterns[Number($('pattern').value)];$('strum-grid').innerHTML=p.steps.map((s,i)=>`<div><small>${i%2?'&':i/2+1}</small><b>${s}</b></div>`).join('');$('pattern-description').textContent=p.description}renderPattern();let strumRunning=false,strumTimer;
stopStrum=()=>{guitar?.stop();clearInterval(strumTimer);strumRunning=false;$('strum-play').textContent='Play pattern';document.querySelectorAll('#strum-grid div').forEach(x=>x.classList.remove('on'))};$('pattern').onchange=()=>{stopStrum();renderPattern()};$('strum-tempo').oninput=()=>$('strum-tempo-label').textContent=$('strum-tempo').value+' BPM';
$('strum-play').onclick=async()=>{if(strumRunning){stopStrum();return}try{const ctx=await getAudio();guitar??=createGuitar(ctx);strumRunning=true;let step=0,next=ctx.currentTime+.05;$('strum-play').textContent='Stop pattern';strumTimer=setInterval(()=>{while(next<ctx.currentTime+.1){const i=step%8,s=patterns[Number($('pattern').value)].steps[i];if(s!=='·')guitar.strum(next,$('strum-chord').value,s==='↑');setTimeout(()=>{if(strumRunning)document.querySelectorAll('#strum-grid div').forEach((x,j)=>x.classList.toggle('on',i===j))},Math.max(0,(next-ctx.currentTime)*1000));step++;next+=30/Number($('strum-tempo').value)}},25)}catch{$('pattern-description').textContent='Audio could not start. Try again in a browser with Web Audio support.'}};
let stream,frame,micPending=false,micGeneration=0,micWatchdog;stopMic=()=>{micGeneration++;micPending=false;clearTimeout(micWatchdog);stream?.getTracks().forEach(t=>t.stop());stream=null;cancelAnimationFrame(frame);$('mic').textContent='Enable microphone';$('mic').setAttribute('aria-busy','false');$('tune-status').textContent='Ready when you are'};
$('mic').onclick=async()=>{
  if(stream||micPending){stopMic();return}
  micPending=true;
  const generation=++micGeneration;
  $('mic').textContent='Cancel microphone request';
  $('mic').setAttribute('aria-busy','true');
  $('tune-status').textContent='Waiting for microphone permission…';
  $('pitch-detail').textContent='Choose Allow in your browser’s microphone prompt. If it is hidden, check the icon beside the address bar.';
  try{
    if(!window.isSecureContext)throw new Error('The tuner needs HTTPS or localhost. On your computer, run npm start and open http://localhost:3000 instead of opening index.html.');
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone access is unavailable here. Open the site directly in Chrome, Edge, Firefox, or Safari.');
    // Start/resume audio inside the click gesture, before awaiting permission.
    // Safari may otherwise leave the audio context suspended indefinitely.
    const ctx=prepareAudio();
    const ready=ctx.state==='running'?Promise.resolve():ctx.resume();
    ready.catch(()=>{});
    micWatchdog=setTimeout(()=>{
      if(generation===micGeneration&&micPending){
        $('tune-status').textContent='Still waiting for your browser…';
        $('pitch-detail').textContent='Allow the microphone using the icon beside the address bar. If you are in a preview, open the site directly. You can cancel and try again.';
      }
    },10000);
    const acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    if(generation!==micGeneration){acquired.getTracks().forEach(t=>t.stop());return}
    stream=acquired;
    let audioTimeout;
    try { await Promise.race([ready,new Promise((_,reject)=>{audioTimeout=setTimeout(()=>reject(new Error('Browser audio did not start. Cancel, then enable the microphone again, or open the site directly in a new browser tab.')),5000)})]); }
    finally { clearTimeout(audioTimeout); }
    if(generation!==micGeneration)return;
    clearTimeout(micWatchdog);
    const source=ctx.createMediaStreamSource(stream),analyser=ctx.createAnalyser();
    analyser.fftSize=4096;
    source.connect(analyser);
    // Keep the graph processing without playing microphone sound back.
    const silent=ctx.createGain();silent.gain.value=0;
    analyser.connect(silent);silent.connect(ctx.destination);
    const release=stopMic;
    stopMic=()=>{source.disconnect();analyser.disconnect();silent.disconnect();stopMic=release;release()};
    const samples=new Float32Array(analyser.fftSize);
    $('mic').textContent='Stop listening';
    $('tune-status').textContent='Listening… pluck one string';
    $('pitch-detail').textContent='Microphone connected. Play one clear note.';
    let last=0;function tick(time){if(!stream)return;if(time-last>130){last=time;analyser.getFloatTimeDomainData(samples);const hz=detectPitch(samples,ctx.sampleRate);if(hz){const midi=Math.round(69+12*Math.log2(hz/440)),ideal=440*2**((midi-69)/12),cents=1200*Math.log2(hz/ideal);$('pitch-note').textContent=notes[(midi%12+12)%12]+(Math.floor(midi/12)-1);$('pitch-detail').textContent=`${hz.toFixed(1)} Hz · ${Math.round(cents)>0?'+':''}${Math.round(cents)} cents`;$('tune-status').textContent=Math.abs(cents)<6?'You’re in tune':cents<0?'A little flat — tighten the string':'A little sharp — loosen the string';$('needle').style.left=`${Math.max(0,Math.min(100,50+cents))}%`}else{$('tune-status').textContent='Listening… pluck one string';$('pitch-note').textContent='—';$('pitch-detail').textContent='Let the note ring clearly.'}}frame=requestAnimationFrame(tick)}frame=requestAnimationFrame(tick)
  }catch(e){
    if(generation!==micGeneration)return;
    stopMic();
    const messages={
      NotAllowedError:'Microphone access was blocked. Click the permissions icon beside the address bar, allow Microphone, and try again. Embedded previews may block it; open the site directly.',
      NotFoundError:'No microphone was found. Connect a microphone or enable your built-in microphone, then try again.',
      NotReadableError:'Your microphone is unavailable or in use. Check Windows microphone privacy settings and close other recording apps, then try again.',
      SecurityError:'Your browser blocked the microphone. Open the site directly using HTTPS or localhost.'
    };
    $('tune-status').textContent=messages[e.name]||e.message||'Could not start the microphone. Please try again.';
    $('pitch-detail').textContent='On Windows: Settings → Privacy & security → Microphone → allow desktop apps to access your microphone.';
  }finally{
    if(generation===micGeneration){micPending=false;clearTimeout(micWatchdog);$('mic').setAttribute('aria-busy','false')}
  }
};
let imageUrl,selectedFile;$('sheet-file').onchange=()=>{selectedFile=$('sheet-file').files[0];if(!selectedFile)return;if(!['image/jpeg','image/png','image/webp'].includes(selectedFile.type)||selectedFile.size>15*1024*1024){$('read-status').textContent='Choose a JPG, PNG, or WebP image under 15 MB.';$('read-sheet').disabled=true;return}if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=URL.createObjectURL(selectedFile);$('sheet-preview').src=imageUrl;$('sheet-preview').hidden=false;$('read-sheet').disabled=false;$('read-status').textContent='Photo ready. For best results, crop closely around printed chord symbols.';showChords('sheet-results',[])};
function displayExtract(text){const chords=extractChords(text);showChords('sheet-results',chords);$('read-status').textContent=chords.length?`Found ${chords.length} chord symbols. Check them against your music.`:'No chord symbols found. Try a clearer crop, or type your chord line below.'}
$('parse-sheet').onclick=()=>displayExtract($('sheet-text').value);
let ocrPromise;function loadOCR(){if(window.Tesseract)return Promise.resolve();ocrPromise??=new Promise((resolve,reject)=>{let script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';script.onload=resolve;script.onerror=()=>{ocrPromise=null;script.remove();reject(new Error('Could not load photo recognition. Check your connection, or paste chord symbols below.'))};document.head.append(script)});return ocrPromise}
$('read-sheet').onclick=async()=>{if(!selectedFile)return;$('read-sheet').disabled=true;$('read-status').textContent='Loading photo recognition…';let worker;try{await loadOCR();worker=await Tesseract.createWorker('eng',1,{logger:m=>{if(m.status)$('read-status').textContent=m.status+(m.progress?' '+Math.round(m.progress*100)+'%':'')}});const result=await worker.recognize(selectedFile);$('sheet-text').value=result.data.text;displayExtract(result.data.text)}catch(e){$('read-status').textContent=e.message||'Photo recognition failed. Try pasting chord symbols below.'}finally{if(worker)await worker.terminate();$('read-sheet').disabled=false}};
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopMic();stopMetro();stopStrum()}});
