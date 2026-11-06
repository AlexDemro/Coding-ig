export function initSongPicker({onSelect,onClear}){
  const input=document.getElementById('song-search'),list=document.getElementById('song-suggestions'),status=document.getElementById('song-search-status');
  let timer,controller,revision=0,results=[],active=-1,selected=false;
  const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1};
  const highlight=()=>{for(const [i,option]of [...list.children].entries()){option.setAttribute('aria-selected',String(i===active));if(i===active){input.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'})}}};
  function select(index){const song=results[index];if(!song)return;clearTimeout(timer);controller?.abort();revision++;selected=true;input.value=song.title+' — '+song.artist;close();status.textContent='Selected '+song.title+' by '+song.artist+'.';onSelect(song)}
  function render(){
    list.replaceChildren();active=-1;
    results.forEach((song,index)=>{const option=document.createElement('div');option.id='song-option-'+index;option.className='song-option';option.setAttribute('role','option');option.setAttribute('aria-selected','false');
      const icon=document.createElement('span');icon.className='song-result-icon';icon.textContent='♫';icon.setAttribute('aria-hidden','true');
      const text=document.createElement('span');text.className='song-result-text';const title=document.createElement('b');title.textContent=song.title;const artist=document.createElement('small');artist.textContent=song.artist+(song.album?' · '+song.album:'');text.append(title,artist);
      const arrow=document.createElement('span');arrow.className='song-result-arrow';arrow.textContent='↗';option.append(icon,text,arrow);option.onpointerdown=e=>e.preventDefault();option.onclick=()=>select(index);list.append(option);
    });
    list.hidden=!results.length;input.setAttribute('aria-expanded',String(Boolean(results.length)));
  }
  input.addEventListener('input',()=>{
    clearTimeout(timer);controller?.abort();const current=++revision;selected=false;onClear();close();results=[];
    const query=input.value.trim();if(query.length<2){status.textContent=query?'Type at least 2 letters to search.':'Search by song title, artist, or both.';return}
    status.textContent='Searching songs…';
    timer=setTimeout(async()=>{
      controller=new AbortController();
      try{
        const response=await fetch('/api/songs?q='+encodeURIComponent(query),{signal:controller.signal});const data=await response.json();
        if(current!==revision)return;
        if(!response.ok)throw new Error(data.error||'Song search is unavailable. Please try again.');
        if(!Array.isArray(data.results))throw new Error('Song search is unavailable. Please try again.');
        results=data.results;render();status.textContent=results.length?`${results.length} song suggestions. Choose one below.`:'No matches yet. Try more of the title or add the artist’s name.';
      }catch(error){if(current!==revision||error.name==='AbortError')return;close();status.textContent=error.message||'Could not load songs. Please try again.'}
    },350);
  });
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'){clearTimeout(timer);controller?.abort();revision++;close();status.textContent='Suggestions closed. Type to search again.';return}
    if((event.key==='ArrowDown'||event.key==='ArrowUp')&&results.length){event.preventDefault();list.hidden=false;input.setAttribute('aria-expanded','true');active=active<0?(event.key==='ArrowDown'?0:results.length-1):(active+(event.key==='ArrowDown'?1:-1)+results.length)%results.length;highlight()}
    if(event.key==='Enter'&&!list.hidden&&results.length){event.preventDefault();select(active<0?0:active)}
  });
  input.addEventListener('focus',()=>{if(results.length&&!selected){list.hidden=false;input.setAttribute('aria-expanded','true')}});
  document.addEventListener('pointerdown',event=>{if(!input.parentElement.contains(event.target)){clearTimeout(timer);controller?.abort();revision++;close()}});
  return {reset(){revision++;clearTimeout(timer);controller?.abort();input.value='';selected=false;results=[];close();status.textContent='Search by song title, artist, or both.'}};
}
