(function(){
  const frame=document.getElementById('app');
  const mobile=location.search.includes('mobile');
  if(mobile)frame.style.width='390px';
  frame.addEventListener('load',async()=>{
    const w=frame.contentWindow,d=w.document,$=id=>d.getElementById(id),results=[];
    const check=(name,condition)=>{results.push({name,pass:!!condition});if(!condition)throw Error(name);};
    const change=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('change',{bubbles:true}));};
    try{
      check('App initializes without errors',!!w.ChaosApp);
      if(mobile)check('Mobile viewport is exactly 390 CSS pixels',w.innerWidth===390);
      w.confirm=()=>true;$('reset').click();
      check('Initial cards rendered',d.querySelectorAll('.weapon-card').length===2&&d.querySelectorAll('.equipment-card').length===8);
      check('No arsenal setup required',!$('setup-notice')&&!$('arsenal-dialog')&&!$('acquisition'));
      check('Purchase mode with all standard weapons',w.ChaosApp.getState().profile.acquisition==='purchase'&&w.ChaosApp.getState().profile.unlocked.length===143);
      check('No owned inventory used',Object.keys(w.ChaosApp.getState().profile.owned).length===0);
      change('rank','100');change('budget','1200');
      $('quartermaster').click();check('Quartermaster capacity immediately updates',$('capacity-value').textContent.endsWith('/ 6'));
      $('quick-traits').querySelector('[data-trait="fanning"]').click();
      $('traits-open').click();for(const id of ['frontiersman','catalyst','doctor'])$('all-traits').querySelector(`[data-trait="${id}"]`).click();
      check('Trait selection preserves keyboard focus',$('traits-dialog').contains(d.activeElement));$('traits-dialog').close();
      check('Solo Catalyst effect explained',$('trait-note').textContent.includes('two extra uses'));
      $('seed').value='graveyard-shift';await w.ChaosApp.roll();
      check('Successful playable roll',w.ChaosEngine.validate(w.ChaosApp.getState().slots,w.ChaosApp.getState().profile).valid);
      check('Export enabled only after a valid roll',!$('export').disabled);
      check('Doctor and Frontiersman shown on medkit',d.querySelector('#equipment').textContent.includes('100 HP per use')&&d.querySelector('#equipment').textContent.includes('+2 tool uses'));
      const first=w.ChaosApp.getState().slots[0];d.querySelector('[data-lock="0"]').click();
      $('seed').value='held-hand';await w.ChaosApp.roll();check('Held weapon survives reroll',w.ChaosApp.getState().slots[0]===first&&w.ChaosApp.getState().locks[0]);
      change('budget','0');check('Changed constraints disable stale export',$('export').disabled);await w.ChaosApp.roll();
      check('Impossible budget is explained',!$('messages').hidden&&$('export').disabled);
      change('budget','1200');$('clear-locks').click();$('seed').value='graveyard-shift';await w.ChaosApp.roll();
      check('No remaining locks',w.ChaosApp.getState().locks.every(v=>!v));
      check('Export carries rule version and valid accounting',w.ChaosApp.exportObject().rulesVersion==='2.9-2026-09-23'&&w.ChaosApp.exportObject().validation.valid);
      d.querySelector('[data-mode="chaos"]').click();await w.ChaosApp.roll();check('Full chaos keeps game validity',w.ChaosApp.getState().profile.mode==='chaos'&&w.ChaosApp.exportObject().validation.valid);
      d.querySelector('[data-mode="playable"]').click();await w.ChaosApp.roll();
      $('rules-open').click();check('Rules explain current limits',$('rules-dialog').textContent.includes('Eight shared equipment slots'));$('rules-dialog').close();
      check('Page fits viewport without horizontal overflow',d.documentElement.scrollWidth<=w.innerWidth);
      check('Settings saved in browser',JSON.parse(w.localStorage.getItem('dead-mans-hand.v1')).profile.traits.includes('quartermaster'));
    }catch(error){results.push({name:'UI sequence',pass:false,error:error.message});}
    const failed=results.filter(r=>!r.pass).length;
    document.body.dataset.status=failed?'FAIL':'PASS';document.title=`${failed?'FAIL':'PASS'} Chaos UI tests`;
    document.getElementById('results').textContent=JSON.stringify({passed:results.length-failed,failed,results},null,2);
    if(!failed){setTimeout(()=>document.getElementById('results').style.display='none',100);frame.style.height=frame.contentWindow.document.documentElement.scrollHeight+'px';}
  });
})();

