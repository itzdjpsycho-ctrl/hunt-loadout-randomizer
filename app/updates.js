(function(){
  'use strict';
  const current=document.documentElement.dataset.buildVersion;
  if(document.documentElement.hasAttribute('data-standalone')||!/^https?:$/.test(location.protocol)||!current)return;
  const notice=document.getElementById('update-notice'),message=document.getElementById('update-message'),button=document.getElementById('update-refresh');
  let checking=false,available=null;
  async function check(){
    if(document.hidden||checking||available)return;
    checking=true;
    try{
      const url=new URL('assets/version.json',location.href);
      url.searchParams.set('check',String(Date.now()));
      const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(8000)});
      if(!response.ok)return;
      const result=await response.json();
      if(typeof result?.version!=='string'||!/^[a-f0-9]{16}$/.test(result.version)||result.version===current)return;
      available=result.version;
      notice.hidden=false;
    }catch{/* A failed update check leaves the current hand usable. */}
    finally{checking=false;}
  }
  button.addEventListener('click',()=>{
    if(!available)return;
    if(!window.dispatchEvent(new Event('chaos-before-update-reload',{cancelable:true}))){
      message.textContent='Wait for the current action to finish, then refresh to update.';
      return;
    }
    const url=new URL(location.href);
    url.searchParams.set('_build',available);
    location.replace(url.href);
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
  for(const event of ['online','focus','pageshow'])window.addEventListener(event,check);
  setInterval(check,60000);
  check();
})();
