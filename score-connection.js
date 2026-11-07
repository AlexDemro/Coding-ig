// Keep missing setup, a missing API, and a failed connection distinct. None of
// these errors says whether an installed engine can read a particular score.
export async function checkScoreConnection({base='',fetcher=globalThis.fetch,timeoutMs=5000,pageURL=globalThis.location?.href||'http://localhost:3000/'}={}){
  const page=new URL(pageURL),local=['localhost','127.0.0.1','[::1]'].includes(page.hostname);
  const offline=(code,message)=>({available:false,code,message});
  if(page.protocol==='file:')return offline('LOCAL_FILE','Open FretMate at http://localhost:3000 after starting it with npm start. Opening index.html directly cannot run the staff reader.');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetcher(base.replace(/\/$/,'')+'/api/score-capabilities',{cache:'no-store',signal:controller.signal});
    if(response.status===404||response.status===405)return offline('API_MISSING',local?'This address is not serving the FretMate staff reader. Start the complete, updated project with npm start, then open its localhost address.':'The staff-reader server is not connected to this website. Printed lyric-and-chord charts can still be read.');
    let data;try{data=await response.json()}catch{return offline('API_INVALID',local?'This address returned a webpage instead of the staff reader. Start FretMate with npm start and open http://localhost:3000.':'The staff-reader server returned an unexpected response. Try again later.');}
    if(response.ok&&data?.available===true)return {available:true,code:'READY',message:'Staff-note recognition is enabled. Chords without printed symbols are suggested arrangements.'};
    if(data?.code==='OMR_APP_SETUP')return offline(data.code,local?'The staff reader’s Node packages or server files are missing in this project folder. Run npm install here, then restart npm start. If it still fails, restore all files from the latest project ZIP.':'The staff-reader server needs maintenance. Printed lyric-and-chord charts can still be read.');
    if(data?.code==='OMR_SETUP')return offline(data.code,local?'The staff reader needs setup in this project folder. Run npm install, then npm run setup:omr, and restart npm start. You do not need to reinstall Audiveris if it is already installed.':'The staff-reader server needs setup. Printed lyric-and-chord charts can still be read.');
    if(data?.code==='OMR_ENGINE_MISSING'||(response.ok&&data?.available===false))return offline('OMR_ENGINE_MISSING',local?'Audiveris was not found by the server running this page. Run npm run setup:omr in this FretMate folder, then restart npm start. If Audiveris is installed elsewhere, use its executable path during setup.':'Staff-note recognition is not set up on this server. Installing Audiveris on your own PC does not enable it on this website.');
    return offline('API_ERROR',local?'The staff-reader server returned an error. Restart npm start in the updated project folder and try again.':'The staff-reader server is temporarily unavailable. Try again later.');
  }catch{return offline('API_UNREACHABLE',local?'The staff-reader server could not be reached. Keep npm start running in your FretMate folder, then reload this page.':'The staff-reader server could not be reached. Check your connection and try again.');}
  finally{clearTimeout(timeout)}
}
