import './reader-ui.js';
import {GuitarTuner,TuningGuide,microphoneConstraints} from './tuner.js';
import {initStrumming} from './strumming-ui.js';
import {notes,transpose,extractChords} from './music.js';
const $=id=>document.getElementById(id);let stopMic=()=>{},stopMetro=()=>{},stopStrum=()=>{};
function navigate(tab){stopMic();stopMetro();stopStrum();document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===tab));document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));$('page-name').textContent=document.querySelector(`[data-tab="${tab}"] span`).textContent;document.querySelector('aside')?.classList.remove('navigation-open');$('menu-toggle').setAttribute('aria-expanded','false');window.scrollTo(0,0)}
$('menu-toggle').onclick=()=>{const open=$('menu-toggle').getAttribute('aria-expanded')!=='true';$('menu-toggle').setAttribute('aria-expanded',String(open));document.querySelector('aside').classList.toggle('navigation-open',open)};
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

function clickAt(ctx,time,accent=true){const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=accent?1100:750;gain.gain.setValueAtTime(.15,time);gain.gain.exponentialRampToValueAtTime(.001,time+.055);osc.connect(gain);gain.connect(ctx.destination);osc.start(time);osc.stop(time+.06)}
let metroRunning=false,metroTimer,metroBeat=0,nextBeat=0;
function dots(){ $('beat-dots').innerHTML=Array.from({length:Number($('beats').value)},()=>'<i></i>').join('') }dots();
$('bpm').oninput=()=>$('bpm-value').textContent=$('bpm').value;
$('beats').onchange=()=>{metroBeat=0;dots()};
stopMetro=()=>{metroRunning=false;clearInterval(metroTimer);$('metro-toggle').textContent='Start metronome';document.querySelectorAll('#beat-dots i').forEach(x=>x.classList.remove('on'))};
$('metro-toggle').onclick=async()=>{if(metroRunning){stopMetro();return}try{const ctx=await getAudio();metroRunning=true;metroBeat=0;nextBeat=ctx.currentTime+.04;$('metro-toggle').textContent='Stop metronome';metroTimer=setInterval(()=>{while(nextBeat<ctx.currentTime+.1){const beat=metroBeat%Number($('beats').value);clickAt(ctx,nextBeat,beat===0);const delay=Math.max(0,(nextBeat-ctx.currentTime)*1000);setTimeout(()=>{if(metroRunning)document.querySelectorAll('#beat-dots i').forEach((x,i)=>x.classList.toggle('on',i===beat))},delay);nextBeat+=60/Number($('bpm').value);metroBeat++}},25)}catch{ $('metro-toggle').textContent='Audio unavailable — try again' }};
let taps=[];$('tap').onclick=()=>{const now=performance.now();if(taps.length&&now-taps.at(-1)>2500)taps=[];taps.push(now);taps=taps.slice(-5);if(taps.length>1){$('bpm').value=Math.round(60000/((now-taps[0])/(taps.length-1)));$('bpm').oninput()}};
stopStrum=initStrumming(getAudio);
let targetMidi=null,guide=new TuningGuide(),lastGuide=null;
function noteName(midi){return notes[(midi%12+12)%12]+(Math.floor(midi/12)-1)}
function setTunerState(state,symbol,label,cents=null){
  $('tuner-readout').setAttribute('data-state',state);
  const active=cents===null?null:Math.max(0,Math.min(12,Math.round(6+cents/8)));
  document.querySelectorAll('[data-arc]').forEach(segment=>{const index=Number(segment.dataset.arc);segment.classList.toggle('lit',active!==null&&(active<=6?index<=active:index>=active));segment.classList.toggle('current',index===active)});
  $('tuner-symbol').textContent=symbol;$('tuner-note-label').textContent=label;
  for(const direction of ['tighten','tuned','loosen'])$('guide-'+direction).classList.toggle('active',state===direction);
}
function resetTunerDisplay(){
  guide=new TuningGuide();lastGuide=null;
  $('pitch-note').textContent=targetMidi===null?'—':noteName(targetMidi);
  setTunerState('idle','♫',targetMidi===null?'PLUCK ONE STRING':'YOUR TARGET NOTE');
}
document.querySelectorAll('[data-string]').forEach(button=>button.onclick=()=>{
  targetMidi=button.dataset.string==='auto'?null:Number(button.dataset.string);
  document.querySelectorAll('[data-string]').forEach(other=>{other.classList.toggle('selected',other===button);other.setAttribute('aria-pressed',String(other===button))});
  resetTunerDisplay();
  $('target-hint').textContent=targetMidi===null?'Auto finds the nearest note. Choose a string if you’re unsure.':`Tune to ${noteName(targetMidi)}. Pluck only the selected string.`;
  $('tune-status').textContent=stream?'Pluck your string to begin':'Enable the microphone to begin';
});
let stream,frame,micPending=false,micGeneration=0,micWatchdog;stopMic=()=>{micGeneration++;micPending=false;clearTimeout(micWatchdog);stream?.getTracks().forEach(t=>t.stop());stream=null;cancelAnimationFrame(frame);$('input-level').value=0;$('input-level-text').textContent='Microphone off';resetTunerDisplay();$('mic').textContent='Enable microphone';$('mic').setAttribute('aria-busy','false');$('tune-status').textContent='Ready when you are'};
$('mic').onclick=async()=>{
  if(stream||micPending){stopMic();return}
  resetTunerDisplay();
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
    const acquired=await navigator.mediaDevices.getUserMedia(microphoneConstraints(navigator.mediaDevices));
    if(generation!==micGeneration){acquired.getTracks().forEach(t=>t.stop());return}
    stream=acquired;
    let audioTimeout;
    try { await Promise.race([ready,new Promise((_,reject)=>{audioTimeout=setTimeout(()=>reject(new Error('Browser audio did not start. Cancel, then enable the microphone again, or open the site directly in a new browser tab.')),5000)})]); }
    finally { clearTimeout(audioTimeout); }
    if(generation!==micGeneration)return;
    clearTimeout(micWatchdog);
    const source=ctx.createMediaStreamSource(stream),analyser=ctx.createAnalyser();
    analyser.fftSize=8192;
    analyser.smoothingTimeConstant=0;
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
    const tuner=new GuitarTuner();
    let last=0;
    function tick(time){
      if(!stream)return;
      if(time-last>=70){
        last=time;
        analyser.getFloatTimeDomainData(samples);
        const reading=tuner.process(samples,ctx.sampleRate,time);
        $('input-level').value=reading.level;
        $('input-level-text').textContent=`${Math.round(reading.db)} dB · ${reading.status==='locked'?'Note detected':reading.status==='settling'?'Finding pitch':reading.status==='weak'?'Very quiet':'Background sound'}`;
        if(reading.hz){
          lastGuide=guide.read(reading.hz,targetMidi);
          const {midi,cents,direction}=lastGuide;
          $('pitch-note').textContent=noteName(midi);
          const close=Math.abs(cents)<.5;
          $('pitch-detail').textContent=`${close?'Right on pitch':Math.abs(Math.round(cents))+' cents '+(cents<0?'below':'above')+' target'} · ${reading.hz.toFixed(1)} Hz`;
          const messages={tuned:'You’re in tune!',tighten:'Tune up — tighten gently',loosen:'Tune down — loosen gently'};
          const symbols={tuned:'✓',tighten:'↑',loosen:'↓'};
          $('tune-status').textContent=messages[direction];
          setTunerState(direction,symbols[direction],direction==='tuned'?'SOUNDS GOOD':direction==='tighten'?'PITCH IS TOO LOW':'PITCH IS TOO HIGH',cents);
        }else if(reading.heldHz&&lastGuide){
          // A short, explicitly marked hold avoids blanking on a single missed
          // frame. It never claims that a held note is still in tune.
          setTunerState('held','…','LAST CLEAR NOTE');
          $('tune-status').textContent='Listening… let the string ring';
          $('pitch-detail').textContent='Holding your last note briefly while the sound settles.';
        }else{
          resetTunerDisplay();
          $('tune-status').textContent=reading.status==='weak'?'Pluck your string a little louder':reading.status==='settling'?'Finding your note…':'Pluck just one string';
          $('pitch-detail').textContent=reading.status==='weak'?'The microphone is listening. Move your guitar a little closer if needed.':reading.status==='settling'?'Let it ring. No need to pluck again yet.':'Mute the other strings and let one clear note ring.';
        }
      }
      frame=requestAnimationFrame(tick);
    }
    frame=requestAnimationFrame(tick);

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
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopMic();stopMetro();stopStrum()}});
