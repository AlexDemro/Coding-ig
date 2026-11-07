import {createGuitar,loadGuitarSamples} from './guitar-audio.js';
import {normalizeStrumming,strummingPresets,presetSteps,strokeSymbols,stepLabel,stepDuration,resizeSteps} from './strumming.js';
const $=id=>document.getElementById(id),storageKey='fretmate-strumming-v1';
export function initStrumming(getAudio){
  let state;try{state=normalizeStrumming(JSON.parse(window.localStorage.getItem(storageKey)))}catch{state=normalizeStrumming()}
  let guitar,running=false,pending=false,timer,generation=0,highlightTimers=new Set();
  const save=()=>{try{window.localStorage.setItem(storageKey,JSON.stringify(state));$('strum-saved').textContent='Saved on this device'}catch{$('strum-saved').textContent='Changes last until you close this page'}};
  const stop=()=>{
    generation++;pending=false;running=false;clearInterval(timer);for(const t of highlightTimers)clearTimeout(t);highlightTimers.clear();guitar?.stop();
    $('strum-play').textContent='Play pattern';$('strum-play').setAttribute('aria-pressed','false');$('strum-play').setAttribute('aria-busy','false');
    document.querySelectorAll('#strum-grid .strum-step').forEach(x=>x.classList.remove('on'));
  };
  function render(){
    $('pattern').value=state.custom?'custom':String(state.preset);$('strum-subdivision').value=String(state.subdivision);$('strum-chord').value=state.chord;
    for(const name of ['tempo','swing','feel','volume'])$('strum-'+name).value=state[name];
    $('strum-tempo-label').textContent=state.tempo+' BPM';$('strum-swing-label').textContent=state.swing===50?'Straight':state.swing+'%';$('strum-feel-label').textContent=state.feel===0?'Even':state.feel+'%';$('strum-volume-label').textContent=state.volume+'%';
    $('strum-grid').classList.toggle('sixteenths',state.subdivision===4);
    $('strum-grid').innerHTML=state.steps.map((step,i)=>`<div class="strum-step${step.accent?' accented':''}"><span class="strum-count">${stepLabel(i,state.subdivision)}</span><button class="stroke-button" data-step="${i}" aria-label="Step ${i+1}, count ${stepLabel(i,state.subdivision)}: ${step.stroke}. Change stroke">${strokeSymbols[step.stroke]}</button><button class="accent-button" data-accent="${i}" aria-label="Accent step ${i+1}, count ${stepLabel(i,state.subdivision)}" aria-pressed="${step.accent}" ${step.stroke==='rest'?'disabled':''}>Accent</button></div>`).join('');
    $('pattern-description').textContent=state.custom?'Your pattern. Click any arrow to cycle downstroke → upstroke → rest.':strummingPresets[state.preset].description;
  }
  $('strum-grid').onclick=event=>{
    const button=event.target.closest('button');if(!button)return;stop();state.custom=true;
    if(button.dataset.step!==undefined){const step=state.steps[Number(button.dataset.step)];step.stroke={down:'up',up:'rest',rest:'down'}[step.stroke];if(step.stroke==='rest')step.accent=false}
    else{const step=state.steps[Number(button.dataset.accent)];if(step.stroke!=='rest')step.accent=!step.accent}
    const stepIndex=button.dataset.step??button.dataset.accent,kind=button.dataset.step===undefined?'accent':'step';render();save();
    document.querySelector(`#strum-grid [data-${kind}="${stepIndex}"]`)?.focus();
  };
  $('pattern').onchange=()=>{if($('pattern').value==='custom')return;stop();state.preset=Number($('pattern').value);state.custom=false;state.steps=presetSteps(state.preset,state.subdivision);render();save()};
  $('strum-subdivision').onchange=()=>{stop();state.subdivision=Number($('strum-subdivision').value);state.steps=resizeSteps(state.steps,state.subdivision);state.custom=true;render();save()};
  $('strum-clear').onclick=()=>{stop();state.steps=state.steps.map(()=>({stroke:'rest',accent:false}));state.custom=true;render();save()};
  $('strum-reset').onclick=()=>{stop();state=normalizeStrumming();render();save()};
  $('strum-chord').onchange=()=>{state.chord=$('strum-chord').value;save()};
  for(const name of ['tempo','swing','feel','volume'])$('strum-'+name).oninput=()=>{state[name]=Number($('strum-'+name).value);$('strum-'+name+'-label').textContent=name==='tempo'?state[name]+' BPM':name==='swing'&&state[name]===50?'Straight':name==='feel'&&state[name]===0?'Even':state[name]+'%';save()};
  $('strum-play').onclick=async()=>{
    if(running||pending){stop();return}
    if(state.steps.every(s=>s.stroke==='rest')){$('pattern-description').textContent='Add a downstroke or upstroke to hear your pattern.';return}
    const current=++generation;pending=true;$('strum-play').textContent='Preparing guitar…';$('strum-play').setAttribute('aria-busy','true');
    try{
      const ctx=await getAudio();if(current!==generation)return;
      if(!guitar){const samples=await loadGuitarSamples(ctx);if(current!==generation)return;guitar=createGuitar(ctx,samples);$('strum-audio-status').textContent=samples?'Acoustic guitar tone':'Using the built-in guitar tone. Reload to try loading the acoustic samples again.'}
      pending=false;running=true;$('strum-play').setAttribute('aria-busy','false');
      let step=0,next=ctx.currentTime+.06;$('strum-play').textContent='Stop pattern';$('strum-play').setAttribute('aria-pressed','true');
      const schedule=()=>{
        if(next<ctx.currentTime-.1)next=ctx.currentTime+.03;
        while(next<ctx.currentTime+.1){
          const index=step%state.steps.length,stroke=state.steps[index];
          if(stroke.stroke!=='rest')guitar.strum(next,state.chord,stroke.stroke==='up',{accent:stroke.accent,feel:state.feel/100,volume:state.volume/100});
          const timeout=setTimeout(()=>{highlightTimers.delete(timeout);if(current===generation&&running)document.querySelectorAll('#strum-grid .strum-step').forEach((x,i)=>x.classList.toggle('on',i===index))},Math.max(0,(next-ctx.currentTime)*1000));highlightTimers.add(timeout);
          next+=stepDuration(index,state.tempo,state.subdivision,state.swing);step++;
        }
      };schedule();timer=setInterval(schedule,25);
    }catch{if(current===generation){stop();$('pattern-description').textContent='Audio could not start. Try again in a browser with Web Audio support.'}}
  };
  render();return stop;
}
