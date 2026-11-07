import {layoutRows,chartDrawing} from './charts.js';
let previews=[],revision=0;
export function clearSheetImages(){revision++;for(const url of previews)URL.revokeObjectURL(url);previews=[];document.getElementById('sheet-pages').replaceChildren()}
let fontPromise;
async function chartFont(){
  fontPromise??=(async()=>{
    try{
      const response=await fetch(new URL('./fonts/inter-latin-wght-normal.woff2',import.meta.url));
      if(!response.ok)throw new Error('Font unavailable');
      const face=new FontFace('FretMate Chart',await response.arrayBuffer(),{weight:'100 900'});
      await face.load();document.fonts.add(face);return '"FretMate Chart", Arial, sans-serif';
    }catch{return 'Arial, Helvetica, sans-serif'}
  })();
  return fontPromise;
}
async function makePNG(page,total){
  const family=await chartFont(),canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('This browser cannot create the image. Try a current version of Safari, Chrome, or Edge.');
  const font=({size,weight=400})=>`${weight} ${size}px ${family}`;
  const drawing=chartDrawing(page,total,(text,style)=>{ctx.font=font(style);return ctx.measureText(text).width});
  for(const element of drawing){
    ctx.fillStyle=element.color;
    if(element.type==='rect')ctx.fillRect(element.x,element.y,element.width,element.height);
    else if(element.type==='line'){ctx.strokeStyle=element.color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(element.x1,element.y1);ctx.lineTo(element.x2,element.y2);ctx.stroke()}
    else{ctx.font=font(element);ctx.fillText(element.text,element.x,element.y)}
  }
  return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('The image could not be saved. Please try again.')),'image/png'));
}
export async function renderSheetImages(rows,metadata={}){
 clearSheetImages();const current=revision;
 const pages=layoutRows(rows,{title:metadata.title||'Your guitar practice sheet',artist:metadata.subtitle||''});
 for(const page of pages){
  const png=await makePNG(page,pages.length);if(current!==revision)return false;
  const url=URL.createObjectURL(png);previews.push(url);
  const card=document.createElement('article');card.className='chart-page';
  const image=document.createElement('img');image.src=url;image.alt=`${metadata.lyrical===false?'Instrumental chords by measure':'Lyrics with chords above the words'}, page ${page.number} of ${pages.length}`;
  const actions=document.createElement('div');actions.className='chart-downloads';
  const download=document.createElement('a');download.className='primary';download.textContent=pages.length===1?'Download image':'Download image · page '+page.number;download.href=url;download.download=`FretMate-chord-sheet-${page.number}.png`;
  actions.append(download);card.append(image,actions);document.getElementById('sheet-pages').append(card);
 }
 return true;
}
