import {layoutRows,chartSVG} from './charts.js';
let previews=[],revision=0;
export function clearSheetImages(){revision++;for(const url of previews)URL.revokeObjectURL(url);previews=[];document.getElementById('sheet-pages').replaceChildren()}
async function makePNG(svg){
 const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
 try{
  const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('The image could not be created. Please try another photo.'));image.src=url});
  const canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('This browser cannot create the image. Try a current version of Safari, Chrome, or Edge.');
  ctx.drawImage(image,0,0);
  return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('The image could not be saved. Please try again.')),'image/png'));
 }finally{URL.revokeObjectURL(url)}
}
export async function renderSheetImages(rows){
 clearSheetImages();const current=revision;
 const pages=layoutRows(rows,{title:'Your guitar practice sheet'});
 for(const page of pages){
  const png=await makePNG(chartSVG(page,pages.length));if(current!==revision)return false;
  const url=URL.createObjectURL(png);previews.push(url);
  const card=document.createElement('article');card.className='chart-page';
  const image=document.createElement('img');image.src=url;image.alt=`Lyrics with chords above the words, page ${page.number} of ${pages.length}`;
  const actions=document.createElement('div');actions.className='chart-downloads';
  const download=document.createElement('a');download.className='primary';download.textContent=pages.length===1?'Download image':'Download image · page '+page.number;download.href=url;download.download=`FretMate-chord-sheet-${page.number}.png`;
  actions.append(download);card.append(image,actions);document.getElementById('sheet-pages').append(card);
 }
 return true;
}
