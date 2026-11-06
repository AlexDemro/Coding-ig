import {analysePitch} from './tuner.js';
export const notes=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export function transpose(chord,steps){return chord.replace(/(^|\/)([A-G])([#b]?)/g,(_,prefix,n,a)=>{let i=notes.indexOf(n)+(a==='#'?1:a==='b'?-1:0);return prefix+notes[((i+steps)%12+12)%12]})}
export function extractChords(text){return text.split(/\s+/).map(x=>x.replace(/^[|()[\],.:;]+|[|()[\],.:;]+$/g,'')).filter(x=>/^[A-G](?:#|b)?(?:(?:maj|min|m|sus|dim|aug|add)?\d*)?(?:\/[A-G](?:#|b)?)?$/.test(x))}
export function detectPitch(samples,rate){return analysePitch(samples,rate).hz}
