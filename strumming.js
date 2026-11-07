export const strummingPresets = [
  {name:'The easy four', description:'One downstroke on each beat. Keep your wrist loose.', strokes:['down','rest','down','rest','down','rest','down','rest']},
  {name:'The campfire', description:'Down, down-up, up-down-up. Keep moving through beat three.', strokes:['down','rest','down','up','rest','up','down','up']},
  {name:'Easy eight', description:'Even eighth notes. Let the upstrokes stay a little lighter.', strokes:['down','up','down','up','down','up','down','up']},
  {name:'Offbeat feel', description:'Play the “and” of each beat. Try a little swing.', strokes:['rest','up','rest','up','rest','up','rest','up']},
];
export const strokeSymbols={down:'↓',up:'↑',rest:'·'};
const limit=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
export function presetSteps(index=1,subdivision=2){
  const source=strummingPresets[index]||strummingPresets[1];
  return Array.from({length:subdivision*4},(_,i)=>({stroke:subdivision===4?(i%2?'rest':source.strokes[i/2]):source.strokes[i],accent:i===0&&source.strokes[0]!=='rest'}));
}
export function normalizeStrumming(input={}){
  if(!input||typeof input!=='object')input={};
  const subdivision=Number(input.subdivision)===4?4:2,preset=Number.isInteger(input.preset)&&input.preset>=0&&input.preset<4?input.preset:1;
  const defaults=presetSteps(preset,subdivision);
  return {preset,custom:input.custom===true,subdivision,
    steps:defaults.map((step,i)=>{const saved=input.steps?.[i];const stroke=Object.hasOwn(strokeSymbols,saved?.stroke)?saved.stroke:step.stroke;return {stroke,accent:stroke!=='rest'&&(saved?saved.accent===true:step.accent)}}),
    chord:['G','D','Em','C','Am','E','A','Dm','F','Bm','D7','G7'].includes(input.chord)?input.chord:'G',
    tempo:Math.round(limit(input.tempo,30,200,80)),swing:limit(input.swing,50,70,50),feel:limit(input.feel,0,100,40),volume:limit(input.volume,0,100,75)};
}
export function stepLabel(index,subdivision=2){return index%subdivision===0?String(Math.floor(index/subdivision)+1):(subdivision===4?['','e','&','a'][index%4]:'&')}
export function stepDuration(index,tempo=80,subdivision=2,swing=50){
  const base=60/limit(tempo,30,200,80)/subdivision,ratio=limit(swing,50,70,50)/100;
  return base*2*(index%2?1-ratio:ratio);
}
export function resizeSteps(steps,subdivision){
  if(steps.length===subdivision*4)return steps.map(s=>({...s}));
  return subdivision===4?Array.from({length:16},(_,i)=>i%2?{stroke:'rest',accent:false}:{...steps[i/2]}):Array.from({length:8},(_,i)=>({...steps[i*2]}));
}
