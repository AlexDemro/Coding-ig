import {layoutChart,chartSVG,chartSummary,spotifyTrack} from './charts.js';
const $=id=>document.getElementById(id);
const example='[Verse]\n[G]Take a little breath, let the [D]day roll by\n[Em]Find a little melody [C]under the sky\n\n[Chorus]\n[G]One more chord and a [D]little more time\n[Em]Your own rhythm, [C]your own rhyme';
export function initCharts(){
  const previews=new Map();
  function clear(prefix){for(const url of previews.get(prefix)||[])URL.revokeObjectURL(url);previews.set(prefix,[]);$(prefix+'-pages').replaceChildren()}
  function stale(prefix){clear(prefix);$(prefix+'-chart-status').textContent='Your changes are ready. Generate the image again to update the preview.'}
  async function png(svg){
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
    try{
      const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Image export failed. Try downloading the SVG image instead.'));image.src=url});
      const canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;
      const context=canvas.getContext('2d');if(!context)throw new Error('PNG export is unavailable in this browser. Use Download SVG instead.');context.drawImage(image,0,0);
      return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not export image.')),'image/png'));
    }finally{URL.revokeObjectURL(url)}
  }
  function save(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
  function generate(prefix){
    clear(prefix);
    const source=$(prefix==='sheet'?'sheet-text':'song-text').value;
    if(!source.trim()){$(prefix+'-chart-status').textContent='Add lyrics and chord symbols first.';return}
    try{
      const pages=layoutChart(source,{title:$(prefix+'-title').value,artist:$(prefix+'-artist').value});
      const summary=chartSummary(pages);
      if(!summary.chords||!summary.lyrics){$(prefix+'-chart-status').textContent=!summary.chords?'No chords found. Add chords in brackets before words, for example [G]Hello [C]there.':'Chords found, but no lyrics. Add the words below the chord line, or place [G] before the words. No lyrics are invented.';return}
      for(const page of pages){
        const svg=chartSVG(page,pages.length),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));previews.get(prefix).push(url);
        const card=document.createElement('article');card.className='chart-page';
        const image=document.createElement('img');image.src=url;image.alt=`${page.title}, chord sheet page ${page.number} of ${pages.length}`;
        const details=document.createElement('details'),heading=document.createElement('summary');heading.textContent='Read page text';details.append(heading);
        for(const row of page.rows){const line=document.createElement('pre');line.textContent=row.chords.map(c=>`${c.text} at character ${c.column+1}`).join(' · ')+(row.chords.length?'\n':'')+row.lyrics;details.append(line)}
        const actions=document.createElement('div');actions.className='chart-downloads';
        const safe=(page.title.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')||'chord-sheet').slice(0,70)+`-page-${page.number}`;
        const download=document.createElement('button');download.className='primary';download.textContent=`Download PNG · page ${page.number}`;
        download.onclick=async()=>{download.disabled=true;try{save(await png(svg),safe+'.png')}catch(error){$(prefix+'-chart-status').textContent=error.message}finally{download.disabled=false}};
        const vector=document.createElement('button');vector.className='secondary';vector.textContent='Download SVG';vector.onclick=()=>save(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),safe+'.svg');
        actions.append(download,vector);card.append(image,actions,details);$(prefix+'-pages').append(card);
      }
      $(prefix+'-chart-status').textContent=`${pages.length} image${pages.length===1?'':'s'} ready · ${summary.chords} chord symbols. Check the chord placement before downloading.`;
    }catch(error){$(prefix+'-chart-status').textContent=error.message}
  }
  $('song-generate').onclick=()=>generate('song');$('sheet-generate').onclick=()=>generate('sheet');
  $('song-example').onclick=()=>{$('song-text').value=example;$('song-title').value='A little more music';$('song-artist').value='Original practice example';stale('song')};
  for(const prefix of ['song','sheet']){
    for(const id of [prefix+'-title',prefix+'-artist',prefix==='sheet'?'sheet-text':'song-text'])$(id).addEventListener('input',()=>stale(prefix));
  }
  $('sheet-text').addEventListener('chart-ready',()=>generate('sheet'));
  $('sheet-file').addEventListener('change',()=>clear('sheet'));
  $('song-spotify').addEventListener('input',()=>{$('spotify-reference').replaceChildren();$('spotify-status').textContent=''});
  $('spotify-add').onclick=()=>{
    const id=spotifyTrack($('song-spotify').value);$('spotify-reference').replaceChildren();
    if(!id){$('spotify-status').textContent='Paste a Spotify track link (open.spotify.com/track/…) or track URI.';return}
    const link=document.createElement('a');link.href='https://open.spotify.com/track/'+id;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open this song in Spotify ↗';
    $('spotify-reference').append(link);
    $('spotify-status').textContent='Spotify reference added. Paste the lyrics and chords below to create your image. This does not import or transcribe the song.';
  };
}
document.addEventListener('DOMContentLoaded',initCharts,{once:true});
