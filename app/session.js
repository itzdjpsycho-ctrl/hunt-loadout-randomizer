(async function () {
  'use strict';
  const A=window.ChaosApp, $=id=>document.getElementById(id), key='dead-mans-hand.room.v1';
  if(document.documentElement.hasAttribute('data-standalone')){$('session-lobby').closest('.session-bar').hidden=true;return;}
  const stable=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(k=>[k,item[k]])):item);
  let room=null, credentials=null, backup=null, baseline='', online=false, busy=false, reading=false, applying=false, dirty=false, epoch=0, timer=null;
  const nameKey='dead-mans-hand.player-name.v1';
  try{$('session-name').value=$('party-invite-name').value=localStorage.getItem(nameKey)||'';}catch{}
  function rememberName(name){try{localStorage.setItem(nameKey,name);}catch{}}
  const inviteDialog=$('party-invite');
  $('party-invite-close').addEventListener('click',()=>inviteDialog.close());
  $('party-invite-form').addEventListener('submit',event=>{
    event.preventDefault();$('session-name').value=$('party-invite-name').value;enter(false);
  });
  const hostControls='[data-mode],[data-ban],#budget,#theme,#intensity,#challenge,#prefer-traits,#custom-ammo,#unique-weapons,#reveal-animation,#single-rerolls,#roulette-roll,#assign-roles,#clear-bans,#roll,#seed';
  const fixedControls='[data-build-count],#team,#reset,[data-restore]';
  const hunterControls='[data-dont-own],[data-mulligan],[data-loadout-mulligan],[data-lock],[data-role],[data-hunter-name],[data-hunter-rank]';
  const activeControls='[data-trait],#quartermaster,#clear-locks';
  const controls=[hostControls,fixedControls,hunterControls,activeControls].join(',');
  const me=()=>room?.members.find(member=>member.id===room.you);
  const host=()=>!!me()?.host;
  const all=()=>host()||room?.control==='everyone';
  function restricted(element){
    if(!room&&!credentials)return false;
    if(element.matches(fixedControls))return true;
    if(!online||busy||dirty)return true;
    if(element.matches(hostControls))return !all();
    if(element.matches(activeControls))return !all()&&A.getState().activeBuild!==me()?.hunter;
    if(element.matches(hunterControls)){
      const seat=Number(element.dataset.hunter??element.dataset.loadoutMulligan??element.dataset.role??element.dataset.hunterName??element.dataset.hunterRank);
      return !all()&&seat!==me()?.hunter;
    }
    return false;
  }
  function lockControls(){
    document.querySelectorAll(controls).forEach(element=>{
      if(element.dataset.sessionDisabled){element.disabled=false;delete element.dataset.sessionDisabled;}
      if(restricted(element)&&!element.disabled){element.disabled=true;element.dataset.sessionDisabled='true';}
    });
  }
  for(const eventName of ['click','change'])document.addEventListener(eventName,event=>{
    const target=event.target.closest(controls);
    if(target&&restricted(target)){event.preventDefault();event.stopImmediatePropagation();lockControls();}
  },true);
  const observer=new MutationObserver(lockControls);
  for(const id of ['squad-loadouts','quick-traits','all-traits','build-tabs','library-history','library-favorites'])if($(id))observer.observe($(id),{childList:true,subtree:true});
  function status(text){$('session-status').textContent=text;}
  function persist(){
    try{
      if(credentials){const saved=JSON.stringify({...credentials,backup});sessionStorage.setItem(key,saved);localStorage.setItem(key,saved);}
      else{
        const previous=JSON.parse(sessionStorage.getItem(key)||'null');
        const saved=JSON.parse(localStorage.getItem(key)||'null');
        if(previous?.token===saved?.token)localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      }
    }
    catch{A.toast('This browser cannot remember your room seat after a reload.');}
  }
  async function request(path,options={}){
    const response=await fetch(new URL('api/sessions'+path,location.href),{
      ...options,cache:'no-store',signal:AbortSignal.timeout(8000),
      headers:{'Content-Type':'application/json',...(credentials?{Authorization:'Bearer '+credentials.token}:{}),...options.headers},
    });
    let body;try{body=await response.json();}catch{throw new Error('Shared sessions require the Uvicorn website.');}
    if(!response.ok){const error=new Error(typeof body.detail==='string'?body.detail:'The room could not accept this change.');error.status=response.status;throw error;}
    return body;
  }
  function renderActivity(){
    const panel=$('room-activity'),list=$('activity-list'),entries=room?.activity||[];
    panel.hidden=false;
    $('activity-empty').hidden=entries.length>0;
    $('activity-empty').textContent=room?'No loadout changes yet.':'Join a shared room to see player activity.';
    const signature=stable(entries);
    if(list.dataset.signature===signature)return;
    list.dataset.signature=signature;
    const E=window.ChaosEngine;
    const item=id=>id?(E.byId.get(id)?.name||id):'Empty';
    const trait=id=>E.traitById.get(id)?.name||id;
    const rows=entries.slice().reverse().map(entry=>{
      const li=document.createElement('li'),heading=document.createElement('strong'),time=document.createElement('time');
      heading.textContent=entry.actor;
      time.dateTime=new Date(entry.time*1000).toISOString();time.textContent=new Date(entry.time*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
      li.append(heading,time);
      for(const change of entry.changes){
        const p=document.createElement('p');p.textContent=`${change.action} ${change.name||'Hunter '+change.hunter} (H${change.hunter})`;li.append(p);
        for(const detail of change.details){
          const line=document.createElement('small');
          if(detail.kind==='item')line.textContent=`Slot ${detail.slot}: ${item(detail.before)} → ${item(detail.after)}`;
          else if(detail.kind==='locks')line.textContent=detail.after.map((held,i)=>held!==detail.before[i]?`${held?'Held':'Released'} slot ${i+1}`:'').filter(Boolean).join('; ');
          else if(detail.kind==='traits')line.textContent='Traits: '+(detail.after.map(trait).join(', ')||'None');
          else if(detail.kind==='loadoutMulligans')line.textContent='Loadout mulligans used: '+detail.after;
          else if(detail.kind==='ammo')line.textContent='Changed ammunition';
          else line.textContent=`${detail.kind==='rank'?'Bloodline':detail.kind}: ${detail.before} → ${detail.after}`;
          li.append(line);
        }
      }
      if(entry.settings.length){const p=document.createElement('p');p.textContent='Changed squad settings: '+entry.settings.join(', ');li.append(p);}
      return li;
    });
    list.replaceChildren(...rows);
  }
  function render(){
    renderActivity();
    const connected=!!credentials;
    $('session-lobby').hidden=connected;$('session-connected').hidden=!connected;
    if(connected){
      $('session-room-code').textContent='ROOM '+credentials.code;
      status(!online?'Reconnecting… edits paused':busy||dirty?'Saving…':`Connected · Hunter ${(me()?.hunter??0)+1}${host()?' · Host':''}`);
      $('session-help').textContent=room?.control==='everyone'?'Everyone can edit this squad. Changes sync automatically.': 'Each player controls their hunter. The host can edit any hunter and manage squad settings. Updates sync about once a second.';
      if(room){
        const rows=room.members.map(member=>{
          const li=document.createElement('li');
          const label=document.createElement('span');label.textContent=`H${member.hunter+1} · ${member.name}${member.id===room.you?' (you)':''}${member.host?' · host':''} · ${member.online?'online':'away'}`;li.append(label);
          if(host()&&member.id!==room.you){const button=document.createElement('button');button.textContent='Remove';button.dataset.sessionRemove=member.id;button.disabled=!online||busy;li.append(button);}
          return li;
        });
        if($('session-members').dataset.signature!==stable(room.members)){
          $('session-members').replaceChildren(...rows);$('session-members').dataset.signature=stable(room.members);
        }
      }
    }
    lockControls();
  }
  function receive(view,force=false,selectSeat=false){
    room=view;online=true;
    const signature=stable(view.state);
    if(selectSeat||signature!==stable(A.getSharedState())){
      const focused=document.activeElement;
      const edit=focused?.matches('[data-hunter-name],[data-hunter-rank]')?{attribute:focused.hasAttribute('data-hunter-name')?'data-hunter-name':'data-hunter-rank',seat:focused.dataset.hunterName??focused.dataset.hunterRank,value:focused.value}:null;
      applying=true;
      try{A.applySharedState(view.state,selectSeat?me()?.hunter:null,!force&&!selectSeat);}finally{applying=false;}
      if(edit&&!force){const field=document.querySelector(`[${edit.attribute}="${edit.seat}"]`);if(field){field.value=edit.value;field.focus({preventScroll:true});}}
    }
    baseline=signature;render();
  }
  function detach(message){
    epoch++;clearTimeout(timer);const previous=backup;
    room=null;credentials=null;backup=null;baseline='';online=false;busy=false;dirty=false;reading=false;
    persist();lockControls();
    if(previous){applying=true;try{A.applySharedState(previous);}finally{applying=false;}}
    $('session-members').replaceChildren();delete $('session-members').dataset.signature;
    if(location.hash.startsWith('#room='))history.replaceState(null,'',location.pathname+location.search);
    render();status(message||'Not in a room');$('session-help').textContent='Your personal squad has been restored. Create or join a room to hunt together.';
  }
  async function refresh(){
    if(!credentials||busy||dirty||reading)return;
    const stamp=epoch;reading=true;
    try{const view=await request('/'+credentials.code);if(stamp===epoch&&!dirty&&!busy)receive(view,false,!room);}
    catch(error){if(stamp!==epoch)return;if([401,404].includes(error.status)){detach(error.message);return;}online=false;render();}
    finally{if(stamp===epoch)reading=false;}
  }
  async function publish(){
    if(!credentials||!dirty||busy||!online)return;
    const stamp=epoch,state=A.getSharedState();dirty=false;busy=true;render();
    try{
      const view=await request('/'+credentials.code,{method:'PUT',body:JSON.stringify({revision:room.revision,state})});
      if(stamp===epoch)receive(view,true);
    }catch(error){
      if(stamp!==epoch)return;
      if([401,404].includes(error.status)){detach(error.message);return;}
      // No replay of an uncertain roll: the server's revision is authoritative.
      online=false;
      A.toast(error.status===409?error.message:'Change was not confirmed. Reconnecting to restore the shared squad.');
      if(room){applying=true;try{A.applySharedState(room.state);}finally{applying=false;}}
    }finally{if(stamp===epoch){busy=false;dirty=false;render();if(!online)refresh();}}
  }
  window.addEventListener('chaos-state-changed',()=>{
    if(!room||applying||stable(A.getSharedState())===baseline)return;
    if(!online||busy)return;
    dirty=true;lockControls();clearTimeout(timer);timer=setTimeout(publish,60);
  });
  $('seed').addEventListener('change',()=>window.dispatchEvent(new Event('chaos-state-changed')));
  async function enter(create){
    if(busy||credentials)return;
    const name=$('session-name').value.trim();if(!name){status('Enter your name first.');$('session-name').focus();return;}
    const code=$('session-code').value.trim().toUpperCase();
    if(!create&&!/^[A-Z2-9]{8}$/.test(code)){status('Enter the eight-character room code.');return;}
    busy=true;$('session-create').disabled=$('session-join').disabled=$('party-invite-join').disabled=true;
    $('party-invite-status').textContent='Joining party…';
    const original=A.getSharedState();
    try{
      const state=structuredClone(original);
      if(create){
        state.profile.rank=100;state.builds.forEach(b=>{b.rank=100;});
        state.buildCount=Number($('session-size').value);state.profile.team=state.buildCount===2?'duo':'trio';
        if(state.buildCount!==original.buildCount)state.builds.forEach(b=>{if(b.slots.some(Boolean))b.dirty=true;});
      }
      const view=await request(create?'':'/'+code+'/join',{method:'POST',body:JSON.stringify(create?{name,control:$('session-control').value,state}:{name})});
      epoch++;backup=original;credentials={code:view.code,token:view.token};persist();baseline='';receive(view,true,true);
      rememberName(name);if(inviteDialog.open)inviteDialog.close();
      history.replaceState(null,'',location.pathname+location.search+'#room='+view.code);
    }catch(error){status(error.message);$('party-invite-status').textContent=error.message;}
    finally{busy=false;$('session-create').disabled=$('session-join').disabled=$('party-invite-join').disabled=false;if(credentials)render();}
  }
  $('session-create').addEventListener('click',()=>enter(true));
  $('session-join').addEventListener('click',()=>enter(false));
  $('session-copy').addEventListener('click',async()=>{
    if(!credentials)return;const url=new URL(location.href);url.hash='room='+credentials.code;
    try{await navigator.clipboard.writeText(url.href);A.toast('Room invite copied.');}catch{status('Share room code: '+credentials.code);}
  });
  $('session-leave').addEventListener('click',async()=>{
    if(busy)return;
    busy=true;render();
    try{if(room)await request('/'+credentials.code+'/members/'+room.you,{method:'DELETE'});detach('Left room.');}
    catch{detach('Left locally. Ask the host to free your seat if you reconnect.');}
  });
  $('session-members').addEventListener('click',async event=>{
    const id=event.target.dataset.sessionRemove;if(!id||busy||!host())return;
    busy=true;render();
    try{await request('/'+credentials.code+'/members/'+id,{method:'DELETE'});}
    catch(error){A.toast(error.message);}
    finally{busy=false;await refresh();render();}
  });
  renderActivity();
  const invitation=location.hash.match(/^#room=([A-Z2-9]{8})$/i);if(invitation)$('session-code').value=invitation[1].toUpperCase();
  if(!/^https?:$/.test(location.protocol)){status('Shared rooms are available on the Uvicorn website.');return;}
  try{
    const response=await fetch(new URL('api/capabilities',location.href),{cache:'no-store',signal:AbortSignal.timeout(5000)});
    if(!response.ok||!(await response.json()).sharedSessions)throw new Error();
  }catch{status('Shared rooms require the Uvicorn server; this copy works locally.');return;}
  $('session-create').disabled=$('session-join').disabled=false;status('Create a room or enter a friend’s code.');
  try{
    const saved=JSON.parse(sessionStorage.getItem(key)||localStorage.getItem(key)||'null');
    if(saved&&/^[A-Z2-9]{8}$/.test(saved.code)&&typeof saved.token==='string'&&(!invitation||saved.code===invitation[1].toUpperCase())){
      credentials={code:saved.code,token:saved.token};backup=saved.backup;persist();render();await refresh();
    }
  }catch{sessionStorage.removeItem(key);}
  if(invitation&&!credentials){
    inviteDialog.showModal();
    try{
      const preview=await request('/'+invitation[1].toUpperCase()+'/invite');
      $('party-invite-title').textContent=`Join ${preview.host}’s party`;
      $('party-invite-seats').textContent=`${preview.members}/${preview.capacity} hunters · ${preview.capacity===2?'Duo':'Trio'}`;
      const full=preview.members>=preview.capacity;
      $('party-invite-status').textContent=full?'This party is full. Ask the host to free a seat.':'Your hunter seat will be assigned when you join.';
      $('party-invite-join').disabled=full;
      $('party-invite-name').focus();
    }catch(error){$('party-invite-seats').textContent='Invitation unavailable';$('party-invite-status').textContent=error.message;}
  }
  setInterval(refresh,1000);
})();
