(function () {
  'use strict';
  const E = window.ChaosEngine, $ = id => document.getElementById(id);
  const STORAGE = 'dead-mans-hand.v1';
  function buyingProfile(source = E.defaults()) {
    return {...source, acquisition: 'purchase', owned: {}, excluded: Array.isArray(source.excluded)?source.excluded.filter(id=>E.byId.has(id)):[],
      unlocked: E.data.items.filter(i => i.kind === 'weapon' && i.availability === 'standard-candidate').map(i => i.id)};
  }
  const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let profile = buyingProfile(), slots = Array(10).fill(null), locks = Array(10).fill(false);
  let lastSeed = '', rollNumber = 0, dirty = false, notice = [], toastTimer, storageWorks = true;
  const emptyBuild = () => ({slots:Array(10).fill(null), locks:Array(10).fill(false), lastSeed:'', dirty:false,name:'',rank:profile.rank,traits:profile.traits.slice(),role:'any',ammo:[null,null]});
  let builds = Array.from({length:3},emptyBuild), buildCount = 1, activeBuild = 0;
  function captureBuild() { builds[activeBuild] = {...builds[activeBuild],slots:slots.slice(),locks:locks.slice(),lastSeed,dirty}; }
  function loadBuild(index) { activeBuild=index; ({slots,locks,lastSeed,dirty}=structuredClone(builds[index])); }
  function selectedBuilds() { captureBuild(); return builds.slice(0,buildCount); }
  function buildProfile(build) { return {...profile,rank:build.rank,traits:build.traits,role:build.role,mulligan:!!build.mulligan}; }
  function hunterName(build,index) { return build.name || `Hunter ${index+1}`; }
  function canExport() { return (!profile.uniqueWeapons||E.uniqueWeapons(selectedBuilds()))&&selectedBuilds().every(b=>!b.dirty&&b.slots.some(Boolean)&&E.validateKit(b.slots,buildProfile(b),b.ammo).valid); }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
    if (saved && saved.version === E.data.version) {
      const restored = buyingProfile({...E.defaults(), ...saved.profile});
      if (!E.profileErrors(restored).length) {
        profile = restored;
        if (Array.isArray(saved.slots) && saved.slots.length === 10 && saved.slots.every(id => id === null || E.byId.has(id))) slots = saved.slots;
        if (Array.isArray(saved.locks) && saved.locks.length === 10) locks = saved.locks.map((v,i) => !!v && !!slots[i]);
        lastSeed = typeof saved.lastSeed === 'string' ? saved.lastSeed : '';
        rollNumber = Number.isInteger(saved.rollNumber) ? saved.rollNumber : 0;
        dirty = !!saved.dirty || (slots.some(Boolean) && (saved.profile.acquisition !== 'purchase' || !E.validate(slots, profile).valid));
        builds.forEach(b=>{b.rank=profile.rank;b.traits=profile.traits.slice();});
        captureBuild();
        if ([1,2,3].includes(saved.buildCount) && Array.isArray(saved.builds) && saved.builds.length===3) {
          buildCount=saved.buildCount;
          builds=saved.builds.map(b=>{
            if (!b || !Array.isArray(b.slots) || b.slots.length!==10 || !b.slots.every(id=>id===null||E.byId.has(id))) return emptyBuild();
            b={...b,name:typeof b.name==='string'?b.name.trim().slice(0,32):'',rank:Number.isInteger(b.rank)&&b.rank>=1&&b.rank<=100?b.rank:profile.rank};
            b.traits=Array.isArray(b.traits)?[...new Set(b.traits.filter(t=>E.traitById.has(t)))].slice(0,15):profile.traits.slice();
            b.role=['any','sniper','close','support'].includes(b.role)?b.role:'any';
            b.ammo=Array.isArray(b.ammo)&&b.ammo.length===2?b.ammo.map((id,n)=>E.ammoOption(b.slots[n],id)?id:null):[null,null];
            return {mulligan:!!b.mulligan,name:b.name,rank:b.rank,traits:b.traits,role:b.role,ammo:b.ammo,slots:b.slots,locks:Array.from({length:10},(_,i)=>!!b.locks?.[i]&&!!b.slots[i]),lastSeed:typeof b.lastSeed==='string'?b.lastSeed:'',dirty:!!b.dirty||(b.slots.some(Boolean)&&!E.validateKit(b.slots,buildProfile(b),b.ammo).valid)};
          });
          loadBuild(Number.isInteger(saved.activeBuild)&&saved.activeBuild>=0&&saved.activeBuild<buildCount?saved.activeBuild:0);
        }
      }
    }
  } catch { storageWorks = false; }
  function save() {
    captureBuild();
    try { localStorage.setItem(STORAGE, JSON.stringify({version:E.data.version, profile, slots, locks, lastSeed, rollNumber, dirty,builds,buildCount,activeBuild})); }
    catch { if (storageWorks) toast('Browser storage is unavailable. This session still works, but settings will not be saved.'); storageWorks = false; }
  }
  function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 4300); }
  const paths = {
    rifle:'M12 60l49-14 25-6 5-9 31-3 13 6 24-2 3-7h129v7H172l-8 9-49 2-9 9-17-2-18 8-7 11-50 9z M105 44l-6 14h-9l-3-9 5-5z',
    pistol:'M53 32h148v12h-78l-10 9 13 37-30 8-17-42H59z M129 44v19h-22l-4-9h17v-10z M58 26h31v8H58z',
    bow:'M90 9q93 50 0 101l-5-8q66-42 0-85z M91 12l39 49-39 47 3-14 26-33-26-34z M105 59h130v4H105z M231 55l16 7-16 7z',
    blade:'M44 93l30-32 8 8-29 32z M69 57l8-8 17 16-8 8z M80 50l106-40-72 64-22-10z',
    medical:'M9 11h22v7H9z M4 20h32v24H4z M17 24v5h-5v7h5v5h7v-5h5v-7h-5v-5z',
    shot:'M26 5l7 5-4 6-3-2-12 20-6 5 1-8 12-20-3-2 4-6z M8 39l-4 7 2 1 4-7z',
    bomb:'M19 13h8v8h-8z M17 20c-20 9-13 31 8 29 20-2 21-25-1-29z M23 13c0-10 10-9 12-4l-3 1c-2-4-6-1-6 3z',
    tool:'M9 7l8 5-1 8 6 8 14 12-6 7-12-16-6-7-8 1-5-9 8 1 3-4z',
    trap:'M2 38l6-14 7 9 7-10 7 10 8-9 7 14-9 9H11z M8 12l6-8 9 7 9-7 7 8-3 8-8-5-6 6-7-6-5 5z',
    card:'M7 5h29v43H7z M10 8v37h23V8z M21 14l8 12-8 12-8-12z',
    box:'M2 17l20-9 21 9-21 10z M2 21l18 9v19L2 40z M24 30l19-9v19l-19 9z'
  };
  function icon(item, weapon = false) {
    if (item?.image) return `<img class="equipment-image" src="${item.image}" alt="${esc(item.name)}" decoding="async">`;
    let key;
    if (weapon) {
      key = !item ? 'rifle' : item.ammo === null ? 'blade' : /bow|chu-ko-nu/.test(item.id) ? 'bow' : item.capacity <= 2 && /pax|scottfield|nagant|dolch|bornheim|conversion|lemat|officer|uppercut|haymaker|new-army|pistol/.test(item.id) ? 'pistol' : 'rifle';
    } else key = !item ? 'box' : item.id === 'first-aid-kit' || item.id === 'medical-pack' ? 'medical' : item.category === 'shots' ? 'shot' : item.category === 'tarot-cards' ? 'card' : item.group === 'Traps' ? 'trap' : /bomb|dynamite|beetle/.test(item.id) ? 'bomb' : /box/.test(item.id) ? 'box' : 'tool';
    return `<svg viewBox="${weapon ? '0 0 300 115' : '0 0 48 54'}" aria-hidden="true" fill="currentColor"><path d="${paths[key]}" fill-rule="evenodd"/></svg>`;
  }
  function card(index, validation, build, hunter) {
    const {slots, locks, lastSeed} = build;
    const item = E.byId.get(slots[index]), weapon = index < 2;
    const type = weapon ? 'weapon-card' : 'equipment-card';
    const rerollButton = `<button class="slot-reroll" data-reroll="${index}" data-hunter="${hunter}" ${locks[index]||build.dirty||!lastSeed||(build.mulligan&&!item)?'disabled':''} aria-label="Reroll ${esc(item?.name||'empty weapon slot')} for ${esc(hunterName(build,hunter))}" title="${locks[index]?'Release hold to reroll':'Reroll only this slot'}">↻</button>`;
    if (!item) return `<article class="${type} empty-card"><div class="card-top"><span>${weapon ? (index ? 'SECONDARY' : 'PRIMARY') : `SLOT ${String(index-1).padStart(2,'0')}`}</span>${rerollButton}</div><div class="${weapon?'weapon':'equipment'}-art">${icon(null,weapon)}</div><h3>${weapon ? (build.mulligan ? 'Lost to mulligan' : lastSeed ? 'Travelling light' : 'Undealt') : (build.mulligan ? 'Lost to mulligan' : 'Awaiting fate')}</h3>${weapon?`<p class="empty-caption">${lastSeed ? 'An empty position can be a legal part of the hand.' : 'Your next weapon is a roll away.'}</p>`:''}</article>`;
    const route = validation.routes?.[index];
    const benefit = E.benefits(item,buildProfile(build));
    const ammo=weapon?E.ammoOption(item.id,build.ammo[index]):null;
    const meta = weapon ? `SIZE ${item.capacity} <span class="dot"></span> ${esc(ammo?.id?ammo.name:item.ammo || 'MELEE')}` : esc(item.kind === 'tool' ? 'TOOL' : (item.category || 'CONSUMABLE').replace('-',' ').toUpperCase());
    return `<article class="${type}${locks[index]?' held':''}"><div class="card-top"><span>${weapon?(index?'SECONDARY':'PRIMARY'):`SLOT ${String(index-1).padStart(2,'0')}`}</span><span class="slot-actions">${weapon&&profile.customAmmo&&E.ammoOptions(item.id).length?`<button class="ammo-reroll" data-ammo-reroll="${index}" data-hunter="${hunter}" ${locks[index]||build.dirty?'disabled':''} title="Reroll ammunition only" aria-label="Reroll ammo for ${esc(item.name)}">Ammo ↻</button>`:''}${rerollButton}<button class="slot-mulligan" data-mulligan="${index}" data-hunter="${hunter}" ${locks[index]||build.dirty||!lastSeed?'disabled':''} title="Reroll this item and lose one random item. Holds do not protect against loss. Weapons have 1/10 the removal weight of other items." aria-label="Mulligan ${esc(item.name)} for ${esc(hunterName(build,hunter))}">M</button><button class="hold-button${locks[index]?' held':''}" data-lock="${index}" data-hunter="${hunter}" aria-pressed="${locks[index]}" aria-label="${locks[index]?'Release':'Hold'} ${esc(item.name)}"><span aria-hidden="true">${locks[index]?'◆':'◇'}</span>${locks[index]?'HELD':'HOLD'}</button></span></div><div class="${weapon?'weapon':'equipment'}-art">${icon(item,weapon)}</div><h3><a class="source-link" href="${esc(item.source)}" target="_blank" rel="noreferrer" title="View ${esc(item.name)} reference">${esc(item.name)}</a></h3><div class="card-meta">${meta}<span class="card-price">${route?.route === 'owned' ? 'OWNED' : route ? '$'+(route.cost+(ammo?.cost||0)) : 'CHECK ACCESS'}</span></div>${benefit.length?`<p class="benefit">${benefit.map(esc).join(' · ')}</p>`:''}</article>`;
  }
  let revealTimers=[],revealAnimations=[];
  function finishReveal(){revealTimers.forEach(clearTimeout);revealTimers=[];revealAnimations.forEach(a=>a.cancel());revealAnimations=[];document.querySelectorAll('.slot-reel').forEach(r=>r.remove());document.querySelectorAll('.reveal-pending,.card-revealed').forEach(c=>c.classList.remove('reveal-pending','card-revealed'));$('skip-reveal').hidden=true;$('squad-loadouts').setAttribute('aria-busy','false');}
  function revealCards(hunter=null,slot=null){
    finishReveal();if(!profile.revealAnimation||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const panels=[...document.querySelectorAll('.hunter-loadout')];
    const cards=(hunter===null?panels:[panels[hunter]]).filter(Boolean).flatMap(p=>[...p.querySelectorAll('.weapon-card,.equipment-card')].filter((c,n)=>(slot===null||n===slot)&&!c.classList.contains('held')));
    if(!cards.length)return;
    $('skip-reveal').hidden=false;$('squad-loadouts').setAttribute('aria-busy','true');
    cards.forEach((card,i)=>{
      const weapon=card.classList.contains('weapon-card');
      const pool=E.data.items.filter(item=>weapon?item.kind==='weapon':item.kind!=='weapon');
      const height=card.clientHeight;
      const reel=document.createElement('div');reel.className='slot-reel';reel.setAttribute('aria-hidden','true');
      const strip=document.createElement('div');strip.className='slot-reel-strip';
      const count=12+i%4;
      for(let n=0;n<count;n++){
        const item=pool[(i*17+n*31+rollNumber*7)%pool.length];
        const row=document.createElement('div');row.className='slot-reel-item';row.style.height=height+'px';
        row.innerHTML=n===count-1?`${card.querySelector('.weapon-art,.equipment-art').innerHTML}<span>${esc(card.querySelector('h3').textContent)}</span>`:`${icon(item,weapon)}<span>${esc(item.name)}</span>`;
        strip.append(row);
      }
      reel.append(strip);card.append(reel);card.classList.add('reveal-pending');
      const duration=1050+i*30;
      revealAnimations.push(strip.animate([{transform:'translateY(0)'},{transform:`translateY(-${(count-1)*height}px)`}],{duration,easing:'cubic-bezier(.12,.55,.18,1)',fill:'forwards'}));
      revealTimers.push(setTimeout(()=>{reel.remove();card.classList.remove('reveal-pending');card.classList.add('card-revealed');},duration));
    });
    revealTimers.push(setTimeout(finishReveal,1050+(cards.length-1)*30+250));
  }
  function teammateProfile(index){const p=buildProfile(builds[index]);return profile.uniqueWeapons?{...p,excluded:[...new Set([...p.excluded,...builds.slice(0,buildCount).flatMap((b,i)=>i===index?[]:b.slots.slice(0,2).filter(Boolean))])]}:p;}
  function renderCards() {
    finishReveal();
    captureBuild();
    const hasHand = slots.some(Boolean), v = E.validateKit(slots,buildProfile(builds[activeBuild]),builds[activeBuild].ammo,hasHand);
    $('squad-loadouts').dataset.count = buildCount;
    $('squad-loadouts').innerHTML = builds.slice(0,buildCount).map((build,i)=>{
      const filled=build.slots.some(Boolean), validation=E.validateKit(build.slots,buildProfile(build),build.ammo,filled);
      const helped=new Set(build.slots.filter(Boolean).flatMap(id=>E.activeSynergies(E.byId.get(id),buildProfile(build))));
      const id=name=>i===activeBuild?`id="${name}"`:'';
      return `<section class="hunter-loadout${build.dirty?' stale':''}" aria-label="${esc(hunterName(build,i))} loadout">
        <div class="hunter-heading"><span class="hunter-number">0${i+1}</span><div class="hunter-identity"><label>HUNTER NAME<input data-hunter-name="${i}" value="${esc(build.name)}" placeholder="Hunter ${i+1}" maxlength="32" aria-label="Hunter ${i+1} name" autocomplete="off"></label><span>${build.dirty?'REROLL TO UPDATE':build.mulligan?'MULLIGAN HAND':filled?'READY TO HUNT':'AWAITING DEPLOYMENT'}</span></div><label class="hunter-rank">BLOODLINE<input ${id('rank')} data-hunter-rank="${i}" type="number" min="1" max="100" step="1" value="${build.rank}" aria-label="Hunter ${i+1} Bloodline rank" inputmode="numeric"></label><span class="ready-dot${filled&&!build.dirty?' ready':''}"></span></div>
        <div class="hunter-actions"><select data-role="${i}" aria-label="Role for ${esc(hunterName(build,i))}">${Object.entries({any:'Any role',sniper:'Sniper',close:'Close range',support:'Support'}).map(([value,label])=>`<option value="${value}" ${build.role===value?'selected':''}>${label}</option>`).join('')}</select><button data-hunter-traits="${i}">Traits · ${build.traits.length}</button><button data-reroll-hunter="${i}" title="Reroll this hunter, keeping held items">↻ Hunter</button></div>
        <div class="ledger"><div><span>CAPACITY</span><b ${id('capacity-value')}>${filled?validation.usedCapacity:'—'} / ${E.capacity(buildProfile(build))}</b></div><div><span>PURCHASES</span><b ${id('spend-value')}>$ ${filled?(validation.cost||0).toLocaleString():'—'}</b></div><div><span>GEAR</span><b ${id('equipment-value')}>${filled?validation.equipmentCount:'—'} / 8</b></div></div>
        <div class="section-label"><span>01 / WEAPONS</span><span>${profile.customAmmo?'MIXED AMMO':'STANDARD AMMO'}</span></div>
        <div ${id('weapons')} class="weapon-grid">${[0,1].map(n=>card(n,validation,build,i)).join('')}</div>
        <div class="section-label equipment-heading"><span>02 / EQUIPMENT</span><span>8 SHARED SLOTS</span></div>
        <div ${id('equipment')} class="equipment-grid">${Array.from({length:8},(_,n)=>card(n+2,validation,build,i)).join('')}</div>
        <div ${id('synergy-summary')} class="synergy-summary" ${!helped.size?'hidden':''}>${[...helped].map(t=>esc(E.traitById.get(t).name)).join(' · ')}</div>
        ${filled&&!validation.valid?`<p class="messages">${validation.errors.map(esc).join('<br>')}</p>`:''}
      </section>`;
    }).join('');
    $('roll-number').textContent = `NO. ${String(rollNumber).padStart(3,'0')}`;
    const messages = [...notice];
    if (hasHand && !v.valid) messages.push(...v.errors);
    else if (hasHand && dirty && !notice.length) messages.push('Settings changed. Deal again to refresh your hand. Held items will stay if they still fit.');
    $('messages').hidden = !messages.length;
    $('messages').innerHTML = [...new Set(messages)].map(esc).join('<br>');
    document.querySelector('.contract').classList.toggle('invalid',hasHand&&(!v.valid||dirty));
    $('copy').disabled = $('export').disabled = !canExport();
    document.querySelectorAll('[data-build-count]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.buildCount)===buildCount)));
    $('build-tabs').innerHTML=Array.from({length:buildCount},(_,i)=>`<button data-build="${i}" aria-pressed="${i===activeBuild}">${esc(hunterName(builds[i],i))}${builds[i].dirty?' · Update':''}</button>`).join('');
    $('roll').querySelector('small').textContent=buildCount===1?'ROLL A NEW LOADOUT':`ROLL ${buildCount} NEW LOADOUTS`;
    const held = locks.filter(Boolean).length;
    $('lock-count').textContent = `${held} item${held===1?'':'s'} held`;
    $('clear-locks').disabled = held===0;
    $('clear-locks').textContent = buildCount>1?`Release H${activeBuild+1} locks`:'Release locks';
    document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===profile.mode)));
    $('favorite-save').disabled=!canExport();
    $('intensity').disabled=profile.mode!=='crazy';
    $('ban-count').textContent=profile.excluded.length;
    $('mode-description').textContent = profile.mode==='playable' ? 'Healing + a melee option included' : profile.mode==='crazy' ? {mild:'Mild: wild gear, with healing and melee.',unhinged:'Unhinged: wild gear, no comfort picks.',cursed:'Cursed: extreme gear bias and repeated consumables.'}[profile.intensity] : 'No comfort picks. The rules still apply.';
  }
  const quick = ['fanning','levering','doctor','frontiersman','bulletgrubber','bolt-thrower'];
  function renderTraits() {
    $('hunter-settings-title').textContent=hunterName(builds[activeBuild],activeBuild);
    $('traits-title').textContent=`Traits: ${hunterName(builds[activeBuild],activeBuild)}`;
    const focusedTrait = document.activeElement?.dataset.trait;
    const focusedGroup = document.activeElement?.closest('#all-traits') ? 'all-traits' : 'quick-traits';
    $('quartermaster').checked = builds[activeBuild].traits.includes('quartermaster');
    $('quick-traits').innerHTML = quick.map(id=>`<label class="quick-trait" title="${esc(E.traitById.get(id).effect)}"><input type="checkbox" data-trait="${id}" ${builds[activeBuild].traits.includes(id)?'checked':''}><span>${esc(E.traitById.get(id).name)}</span></label>`).join('');
    $('all-traits').innerHTML = E.data.traits.map(t=>`<label class="trait-option"><input type="checkbox" data-trait="${t.id}" ${builds[activeBuild].traits.includes(t.id)?'checked':''}><span><b>${esc(t.name)}</b><small>${esc(t.effect)}</small></span></label>`).join('');
    $('trait-count').textContent = `${builds[activeBuild].traits.length} / 15`;
    $('modal-trait-count').textContent = `${builds[activeBuild].traits.length} of 15 equipped trait slots selected`;
    if (builds[activeBuild].traits.includes('frontiersman')) $('trait-note').textContent = profile.team==='solo'&&builds[activeBuild].traits.includes('catalyst') ? 'Frontiersman + Catalyst, solo: two extra uses of limited-use tools. Still eight equipment slots.' : 'Frontiersman: one extra use of limited-use tools. Still eight equipment slots.';
    else $('trait-note').textContent = 'Select your equipped traits to favour compatible gear.';
    if (focusedTrait) $(focusedGroup).querySelector(`[data-trait="${focusedTrait}"]`)?.focus({preventScroll:true});
  }
  function renderProfile() {
    for (const id of ['budget','team','theme','intensity','challenge']) $(id).value = profile[id] ?? '';
    $('prefer-traits').checked = profile.preferTraits;
    $('custom-ammo').checked=!!profile.customAmmo;
    $('unique-weapons').checked=!!profile.uniqueWeapons;
    $('reveal-animation').checked=!!profile.revealAnimation;
    renderTraits();
  }
  function changed() { captureBuild(); builds.forEach(b=>{if(b.slots.some(Boolean))b.dirty=true;});loadBuild(activeBuild); notice=[]; save(); renderProfile(); renderCards(); }
  function hunterChanged(index){captureBuild();builds[index].dirty=builds[index].slots.some(Boolean);loadBuild(activeBuild);notice=[];save();renderProfile();renderCards();}
  function setTrait(id, checked) {
    if (checked && !builds[activeBuild].traits.includes(id)) {
      if(builds[activeBuild].traits.length>=15){toast('A Hunter can have at most 15 traits. Uncheck one first.');renderTraits();return;}
      builds[activeBuild].traits.push(id);
    } else if (!checked) builds[activeBuild].traits=builds[activeBuild].traits.filter(t=>t!==id);
    hunterChanged(activeBuild);
  }
  function freshSeed(){const bytes=new Uint32Array(2);crypto.getRandomValues(bytes);return Array.from(bytes,n=>n.toString(36)).join('-');}
  const LIBRARY='dead-mans-hand.library.v1';
  let library={history:[],favorites:[]};
  function validSnapshot(entry){
    return entry&&typeof entry.id==='string'&&typeof entry.label==='string'&&typeof entry.created==='string'&&entry.version===E.data.version&&
      [1,2,3].includes(entry.buildCount)&&entry.profile&&typeof entry.profile==='object'&&!E.profileErrors(entry.profile).length&&Array.isArray(entry.builds)&&entry.builds.length===3&&entry.builds.every(b=>
        b&&typeof b.name==='string'&&Number.isInteger(b.rank)&&b.rank>=1&&b.rank<=100&&Array.isArray(b.slots)&&b.slots.length===10&&b.slots.every(id=>id===null||E.byId.has(id))&&Array.isArray(b.locks)&&b.locks.length===10&&typeof b.lastSeed==='string'&&Array.isArray(b.ammo)&&b.ammo.length===2&&
        !E.profileErrors({...entry.profile,rank:b.rank,traits:b.traits,role:b.role}).length);
  }
  try{const stored=JSON.parse(localStorage.getItem(LIBRARY)||'null');if(stored){library.history=(stored.history||[]).filter(validSnapshot).slice(0,30);library.favorites=(stored.favorites||[]).filter(validSnapshot).slice(0,50);}}catch{}
  function saveLibrary(){try{localStorage.setItem(LIBRARY,JSON.stringify(library));}catch{toast('Saved builds could not be stored. Export JSON to keep a copy.');}}
  function snapshot(label){captureBuild();return {id:freshSeed(),version:E.data.version,label,created:new Date().toISOString(),profile:structuredClone(profile),builds:structuredClone(builds),buildCount,activeBuild,rollNumber,seedInput:$('seed').value};}
  function recordHistory(){if(!canExport())return;const entry=snapshot(builds.slice(0,buildCount).map(hunterName).join(' + '));library.history.unshift(entry);library.history=library.history.slice(0,30);saveLibrary();}
  function restoreSnapshot(entry){
    if(!validSnapshot(entry)){toast('This saved squad is not compatible with the current catalog.');return;}
    recordHistory();
    profile=buyingProfile({...E.defaults(),...structuredClone(entry.profile)});
    builds=structuredClone(entry.builds);buildCount=entry.buildCount;
    builds.forEach(b=>{b.dirty=b.slots.some(Boolean)&&!E.validateKit(b.slots,buildProfile(b),b.ammo).valid;});
    loadBuild(Number.isInteger(entry.activeBuild)&&entry.activeBuild>=0&&entry.activeBuild<buildCount?entry.activeBuild:0);
    rollNumber=entry.rollNumber||0;$('seed').value=entry.seedInput||'';notice=[];save();renderProfile();renderCards();$('library-dialog').close();toast('Saved squad and its settings restored.');
  }
  function renderLibrary(){
    for(const type of ['favorites','history'])$('library-'+type).innerHTML=library[type].length?library[type].map(entry=>`<article class="saved-squad"><div><b>${esc(entry.label)}</b><small>${esc(new Date(entry.created).toLocaleString())} · ${entry.buildCount} hunter${entry.buildCount===1?'':'s'} · ${esc(entry.profile.mode)}</small><p>${entry.builds.slice(0,entry.buildCount).map((b,i)=>`${esc(hunterName(b,i))}: ${b.slots.slice(0,2).filter(Boolean).map(id=>esc(E.byId.get(id).name)).join(' / ')}`).join('<br>')}</p></div><div class="saved-actions"><button data-restore="${esc(entry.id)}" data-list="${type}">Restore</button><button data-delete-save="${esc(entry.id)}" data-list="${type}" aria-label="Delete ${esc(entry.label)}">Delete</button></div></article>`).join(''):`<p class="muted small">${type==='history'?'Your last 30 successful squad builds will appear here.':'Save your current squad as a favorite to keep it here.'}</p>`;
  }
  function renderBans(){
    const query=$('ban-search').value.trim().toLowerCase(),kind=$('ban-kind').value;
    const items=E.data.items.filter(i=>i.availability==='standard-candidate'&&(!kind||i.kind===kind)&&i.name.toLowerCase().includes(query));
    $('ban-list').innerHTML=items.map(i=>`<label class="ban-option"><input type="checkbox" data-ban="${i.id}" ${profile.excluded.includes(i.id)?'checked':''}><span>${esc(i.name)}<small>${esc(i.kind)} · $${i.price}</small></span></label>`).join('')||'<p>No matching items.</p>';
    $('ban-total').textContent=`${profile.excluded.length} items banned for the squad`;
  }
  function rollHunter(index){
    if($('roll').disabled)return;
    captureBuild();const build=builds[index];if(!build)return;
    const seed=`${$('seed').value.trim()||freshSeed()}:hunter-${index+1}:roll-${rollNumber+1}`;
    const result=E.generateKit(teammateProfile(index),seed,build);
    if(!result.ok){notice=result.errors.map(e=>`${hunterName(build,index)}: ${e}`);renderCards();return;}
    builds[index]={...build,slots:result.slots,ammo:result.ammo,lastSeed:seed,dirty:false,mulligan:false};
    loadBuild(activeBuild);rollNumber++;notice=[];save();recordHistory();renderCards();revealCards(index);toast(`${hunterName(build,index)} rerolled. Teammates kept.`);
  }
  async function roll(roulette=false) {
    if($('roll').disabled)return;
    roulette=roulette===true;
    finishReveal();
    const seed=$('seed').value.trim()||freshSeed();
    $('roll').disabled=true;
    await new Promise(resolve=>setTimeout(resolve,35));
    try {
      captureBuild();
      const challenges=roulette?E.rouletteOrder(seed):[profile.challenge];
      let dealt,chosen;
      for(const challenge of challenges){
        const candidate=E.generateSquad(builds.slice(0,buildCount).map(b=>({...buildProfile(b),challenge})),builds.slice(0,buildCount),seed,profile.uniqueWeapons);
        if(candidate.ok){dealt=candidate;chosen=challenge;break;}
        dealt=candidate;
      }
      if(!dealt.ok){notice=[...(roulette?['No roulette challenge fits the current roles, bans, budget and holds.']:[]),...dealt.errors];if(!roulette)builds.slice(0,buildCount).forEach(b=>b.dirty=true);loadBuild(activeBuild);save();renderCards();return;}
      if(chosen!==profile.challenge)builds.slice(buildCount).forEach(b=>{if(b.slots.some(Boolean))b.dirty=true;});
      profile.challenge=chosen;
      dealt.results.forEach((r,i)=>{builds[i]={...builds[i],slots:r.slots,ammo:r.ammo,locks:builds[i].locks,lastSeed:r.seed,dirty:false,mulligan:false};});
      loadBuild(activeBuild);rollNumber++;notice=[];
      save();recordHistory();renderProfile();renderCards();revealCards();
      if(roulette){$('squad-options-dialog').close();toast('Challenge drawn: '+{'no-scopes':'No scopes',bows:'Everyone brings a Hunting Bow',budget300:'$300 per hunter'}[chosen]);}
      $('roll').setAttribute('aria-label',`Deal another loadout. Last roll ${lastSeed}`);
    } catch(error){notice=['The squad could not be dealt. Check the settings and try again.'];renderCards();console.error(error);}
    finally{$('roll').disabled=false;}
  }  function rerollOne(hunter,index) {
    if($('roll').disabled)return;
    captureBuild();
    const build=builds[hunter];
    if(!build||build.locks[index]){toast('Release this item before rerolling it.');return;}
    if(build.dirty||!build.lastSeed){toast('Deal a fresh loadout before rerolling a slot.');return;}
    const seed=`${$('seed').value.trim()||freshSeed()}:hunter-${hunter+1}:slot-${index+1}:${rollNumber+1}`;
    const result=E.rerollKit(teammateProfile(hunter),seed,build,index);
    if(!result.ok){toast(result.errors.join(' '));return;}
    build.slots=result.slots;build.ammo=result.ammo;build.lastSeed=seed;
    loadBuild(activeBuild);rollNumber++;notice=[];save();recordHistory();renderCards();
    document.querySelector(`[data-reroll="${index}"][data-hunter="${hunter}"]`)?.focus({preventScroll:true});
    revealCards(hunter,index);
    toast(`${hunterName(build,hunter)}: slot rerolled. Other slots kept.`);
  }
  function mulliganOne(hunter,index){
    if($('roll').disabled)return;
    captureBuild();const build=builds[hunter];
    if(!build||build.dirty||!build.lastSeed)return;
    const seed=`${$('seed').value.trim()||freshSeed()}:hunter-${hunter+1}:mulligan-${index+1}:${rollNumber+1}`;
    const result=E.mulliganKit(teammateProfile(hunter),seed,build,index);
    if(!result.ok){toast(result.errors.join(' '));return;}
    Object.assign(build,{slots:result.slots,ammo:result.ammo,locks:result.locks,mulligan:true,lastSeed:seed});
    loadBuild(activeBuild);rollNumber++;notice=[];save();recordHistory();renderCards();
    (document.querySelector(`[data-mulligan="${index}"][data-hunter="${hunter}"]`)||document.querySelector(`[data-reroll-hunter="${hunter}"]`))?.focus({preventScroll:true});
    toast(hunterName(build,hunter)+': mulligan used. Lost '+E.byId.get(result.removed.id).name+'.');
  }
  function exportObject(){const hands=selectedBuilds().map((b,i)=>({hunter:i+1,name:hunterName(b,i),rank:b.rank,ammo:b.ammo.map((id,n)=>({...E.ammoOption(b.slots[n],id)})),role:b.role,traits:b.traits,profile:structuredClone(buildProfile(b)),seed:b.lastSeed,slots:b.slots.map((id,n)=>id?{position:n<2?`weapon-${n+1}`:`equipment-${n-1}`,id,name:E.byId.get(id).name,source:E.byId.get(id).source}:null),validation:E.validateKit(b.slots,buildProfile(b),b.ammo)}));return {app:"Dead Man's Hand",rulesVersion:E.data.version,profile:structuredClone(profile),...hands[activeBuild],buildCount,builds:hands};}
  function exportTeamText(){captureBuild();const current=activeBuild;const text=builds.slice(0,buildCount).map((b,i)=>{loadBuild(i);return `${hunterName(b,i)}\n${exportText()}`;}).join('\n\n────────────\n\n');loadBuild(current);return text;}
  function exportText(){const v=E.validateKit(slots,buildProfile(builds[activeBuild]),builds[activeBuild].ammo);return [`DEAD MAN'S HAND · Hunt: Showdown 1896`,`Rules ${E.data.version} · seed ${lastSeed}`,`Capacity ${v.usedCapacity}/${E.capacity(buildProfile(builds[activeBuild]))} · New purchases $${v.cost}`,`Mode: ${profile.mode} · Bloodline ${builds[activeBuild].rank}`,`Traits: ${builds[activeBuild].traits.map(id=>E.traitById.get(id).name).join(', ')||'None'}`,'',...slots.map((id,n)=>`${n<2?'Weapon '+(n+1):'Equipment '+(n-1)}: ${id?E.byId.get(id).name+(n<2&&builds[activeBuild].ammo[n]?' + '+E.ammoOption(id,builds[activeBuild].ammo[n]).name:''):'Empty'}${v.routes?.[n]?.route==='owned'?' (owned)':''}`),'','Role: '+builds[activeBuild].role+' · Challenge: '+profile.challenge+' · Intensity: '+profile.intensity].join('\n');}
  document.addEventListener('click',event=>{
    const ammoRoll=event.target.closest('[data-ammo-reroll]');if(ammoRoll){
      if(ammoRoll.disabled||$('roll').disabled)return;
      captureBuild();const hunter=Number(ammoRoll.dataset.hunter),index=Number(ammoRoll.dataset.ammoReroll),build=builds[hunter];
      if(build.dirty)return;
      const seed=`${$('seed').value.trim()||freshSeed()}:ammo:${hunter}:${index}:${rollNumber+1}`;
      const result=E.rerollAmmo(buildProfile(build),seed,build,index);
      if(!result.ok){toast(result.errors.join(' '));return;}
      build.ammo=result.ammo;build.lastSeed=seed;loadBuild(activeBuild);rollNumber++;notice=[];save();recordHistory();renderCards();
      document.querySelector(`[data-ammo-reroll="${index}"][data-hunter="${hunter}"]`)?.focus({preventScroll:true});toast('Ammo rerolled. All equipment kept.');return;
    }
    const hunterRoll=event.target.closest('[data-reroll-hunter]');if(hunterRoll){rollHunter(Number(hunterRoll.dataset.rerollHunter));return;}
    const hunterTraits=event.target.closest('[data-hunter-traits]');if(hunterTraits){captureBuild();loadBuild(Number(hunterTraits.dataset.hunterTraits));save();renderProfile();renderCards();$('traits-dialog').showModal();return;}
    const restore=event.target.closest('[data-restore]');if(restore){const entry=library[restore.dataset.list]?.find(e=>e.id===restore.dataset.restore);if(entry)restoreSnapshot(entry);return;}
    const remove=event.target.closest('[data-delete-save]');if(remove){const list=remove.dataset.list;if(library[list]){library[list]=library[list].filter(e=>e.id!==remove.dataset.deleteSave);saveLibrary();renderLibrary();}return;}
    const mulligan=event.target.closest('[data-mulligan]');if(mulligan){if(!mulligan.disabled)mulliganOne(Number(mulligan.dataset.hunter),Number(mulligan.dataset.mulligan));return;}
    const reroll=event.target.closest('[data-reroll]');if(reroll){if(!reroll.disabled)rerollOne(Number(reroll.dataset.hunter),Number(reroll.dataset.reroll));return;}
    const count=event.target.closest('[data-build-count]');if(count){if($('roll').disabled||Number(count.dataset.buildCount)===buildCount)return;captureBuild();buildCount=Number(count.dataset.buildCount);loadBuild(Math.min(activeBuild,buildCount-1));profile.team=['solo','duo','trio'][buildCount-1];changed();return;}
    const tab=event.target.closest('[data-build]');if(tab){if($('roll').disabled)return;captureBuild();loadBuild(Number(tab.dataset.build));save();renderProfile();renderCards();$('build-tabs').querySelector(`[data-build="${activeBuild}"]`).focus();return;}
    const lock=event.target.closest('[data-lock]');if(lock){if($('roll').disabled)return;captureBuild();loadBuild(Number(lock.dataset.hunter));const n=Number(lock.dataset.lock);locks[n]=!locks[n];save();renderProfile();renderCards();document.querySelector(`[data-hunter="${activeBuild}"][data-lock="${n}"]`)?.focus({preventScroll:true});}
    const close=event.target.closest('[data-close]');if(close)$(close.dataset.close).close();
    const mode=event.target.closest('[data-mode]');if(mode){profile.mode=mode.dataset.mode;changed();}
  });
  document.addEventListener('change',event=>{
    const target=event.target;
    if(target.hasAttribute('data-role')){const index=Number(target.dataset.role);captureBuild();builds[index].role=target.value;hunterChanged(index);return;}
    if(target.dataset.ban){const id=target.dataset.ban;profile.excluded=target.checked?[...new Set([...profile.excluded,id])]:profile.excluded.filter(v=>v!==id);changed();renderBans();document.querySelector(`[data-ban="${id}"]`)?.focus({preventScroll:true});return;}
    if(target.matches('[data-hunter-name],[data-hunter-rank]')){
      const isRank=target.hasAttribute('data-hunter-rank');
      const index=Number(isRank?target.dataset.hunterRank:target.dataset.hunterName);
      const value=isRank?Number(target.value):target.value.trim().slice(0,32);
      if(isRank&&(!Number.isInteger(value)||value<1||value>100)){target.value=builds[index].rank;toast('Bloodline rank must be a whole number from 1 to 100.');return;}
      captureBuild();
      const build=builds[index],key=isRank?'rank':'name';
      if(build[key]===value)return;
      build[key]=value;
      if(isRank){build.dirty=build.slots.some(Boolean);notice=[];}
      loadBuild(activeBuild);save();renderProfile();renderCards();
      return;
    }
    if(target.dataset.trait){setTrait(target.dataset.trait,target.checked);return;}
  });
  for(const id of ['budget','team','theme','intensity','challenge']) $(id).addEventListener('change',()=>{
    const old=profile[id],raw=$(id).value;
    profile[id]=id==='budget'?(raw===''?null:Number(raw)):raw;
    const errors=E.profileErrors(profile);
    if(errors.length){profile[id]=old;$(id).value=old??'';toast(errors[0]);return;}
    if(id==='team'){captureBuild();buildCount=['solo','duo','trio'].indexOf(profile.team)+1;loadBuild(Math.min(activeBuild,buildCount-1));}
    changed();
  });
  $('quartermaster').addEventListener('change',()=>setTrait('quartermaster',$('quartermaster').checked));
  $('prefer-traits').addEventListener('change',()=>{profile.preferTraits=$('prefer-traits').checked;changed();});
  $('custom-ammo').addEventListener('change',()=>{profile.customAmmo=$('custom-ammo').checked;changed();});
  $('unique-weapons').addEventListener('change',()=>{profile.uniqueWeapons=$('unique-weapons').checked;changed();});
  $('reveal-animation').addEventListener('change',()=>{profile.revealAnimation=$('reveal-animation').checked;finishReveal();save();});
  $('roulette-roll').addEventListener('click',()=>roll(true));
  $('skip-reveal').addEventListener('click',finishReveal);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')finishReveal();});
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{if(event.matches)finishReveal();});
  $('squad-options-open').addEventListener('click',()=>{$('squad-options-dialog').showModal();});
  $('assign-roles').addEventListener('click',()=>{captureBuild();builds.slice(0,buildCount).forEach((b,i)=>b.role=['sniper','close','support'][i]);changed();toast('Roles assigned. Deal again to equip them.');});
  $('bans-open').addEventListener('click',()=>{renderBans();$('bans-dialog').showModal();});
  $('ban-search').addEventListener('input',renderBans);$('ban-kind').addEventListener('change',renderBans);
  $('clear-bans').addEventListener('click',()=>{profile.excluded=[];changed();renderBans();});
  $('library-open').addEventListener('click',()=>{renderLibrary();$('library-dialog').showModal();});
  $('favorite-save').addEventListener('click',()=>{if(!canExport())return;if(library.favorites.length>=50){toast('You have 50 favorites. Remove one to save another.');return;}const label=$('favorite-name').value.trim().slice(0,64)||builds.slice(0,buildCount).map(hunterName).join(' + ');library.favorites.unshift(snapshot(label));saveLibrary();renderLibrary();$('library-dialog').showModal();toast('Squad saved as a favorite.');});
  $('traits-open').addEventListener('click',()=>{$('traits-dialog').showModal();});
  $('rules-open').addEventListener('click',()=>{$('rules-dialog').showModal();});
  $('clear-locks').addEventListener('click',()=>{locks.fill(false);save();renderCards();});
  $('roll').addEventListener('click',roll);
  $('copy').addEventListener('click',async()=>{
    if(!canExport())return;
    const text=exportTeamText();
    try{await navigator.clipboard.writeText(text);toast('Loadout copied. Good hunting.');}
    catch{const field=document.createElement('textarea');field.value=text;field.style.position='fixed';field.style.opacity='0';document.body.append(field);field.select();const copied=document.execCommand('copy');field.remove();toast(copied?'Loadout copied.':'Copy is unavailable here. Use Save JSON instead.');}
  });
  $('export').addEventListener('click',()=>{if(!canExport())return;const url=URL.createObjectURL(new Blob([JSON.stringify(exportObject(),null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`hunt-chaos-${lastSeed.replace(/[^a-z0-9-]/gi,'-').slice(0,60)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Loadout saved as JSON.');});
  $('reset').addEventListener('click',()=>{if(!confirm('Reset your hunter settings and held cards?'))return;profile=buyingProfile();builds=Array.from({length:3},emptyBuild);buildCount=1;loadBuild(0);lastSeed='';rollNumber=0;dirty=false;notice=[];$('seed').value='';save();renderProfile();renderCards();});
  renderProfile();renderCards();
  window.ChaosApp={getState:()=>({profile:structuredClone(buildProfile(builds[activeBuild])),slots:slots.slice(),locks:locks.slice(),lastSeed,dirty,buildCount,activeBuild,builds:structuredClone(selectedBuilds())}),roll,exportObject,exportTeamText};
})();

