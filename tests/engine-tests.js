(function(){
  const E=window.ChaosEngine, results=[];
  function test(name, fn){try{fn();results.push({name,pass:true});}catch(error){results.push({name,pass:false,error:error.message});}}
  function assert(ok,msg='Assertion failed'){if(!ok)throw new Error(msg);}
  const profile=()=>({...E.defaults(),rank:100,unlocked:E.data.items.filter(i=>i.kind==='weapon'&&i.availability==='standard-candidate').map(i=>i.id)});
  const partial=ids=>[...ids,...Array(10-ids.length).fill(null)];
  test('Two melee tools allowed; third including throwing tools rejected',()=>{
    const p=profile();
    assert(E.validate(partial(['baseball-bat',null,'knife','throwing-axes']),p,false).valid);
    const held=partial([null,null,'knife','throwing-axes','throwing-spear']);
    assert(!E.validate(held,p,false).valid);
    assert(!E.generate(p,'too-many-held-melee',held).ok);
    assert(E.generate(p,'two-held-melee',partial([null,null,'knife','throwing-axes'])).ok);
  });
  test('Catalog has 227 entries and 23 traits',()=>{assert(E.byId.size===227);assert(E.data.traits.length===23);});
  test('No unknown weapon is assumed unlocked',()=>{assert(!E.generate(E.defaults(),'new').ok);});
  test('Rank gates purchases but not confirmed owned instances',()=>{const p=profile();p.rank=1;const spear=E.byId.get('throwing-spear');assert(!E.acquisition(spear,p));p.owned[spear.id]=1;assert(E.acquisition(spear,p).route==='owned');assert(!E.acquisition(spear,p,2));p.rank=33;assert(E.acquisition(spear,p,2).route==='purchase');});
  test('Quartermaster changes 5 to 6 only while equipped',()=>{const p=profile();const s=partial(['mosin-nagant','dolch-96']);assert(!E.validate(s,p,false).valid);p.traits=['quartermaster'];assert(E.validate(s,p,false).valid);p.traits=[];assert(!E.validate(s,p,false).valid);});
  test('Duplicate tools forbidden across equipment slots',()=>{const p=profile();assert(!E.validate(partial([null,null,'knife','knife']),p,false).valid);});
  test('Four throwable consumables legal; five distinct throwables illegal',()=>{const p=profile();const ids=[null,null,'frag-bomb','fire-bomb','dynamite-stick','hive-bomb'];assert(E.validate(partial(ids),p,false).valid);assert(!E.validate(partial([...ids,'poison-bomb']),p,false).valid);});
  test('Repeated consumables legal within category limit',()=>{assert(E.validate(partial([null,null,'vitality-shot','vitality-shot','vitality-shot','vitality-shot']),profile(),false).valid);});
  test('Scarce and event items require separate access',()=>{const p=profile();const scarce=E.byId.get('wildland'),event=E.byId.get('burgess');assert(!E.acquisition(scarce,p));p.unlocked.push('wildland');assert(!E.acquisition(scarce,p));p.owned.wildland=1;assert(E.acquisition(scarce,p));assert(!E.acquisition(event,p));p.unlocked.push('burgess');assert(E.acquisition(event,p).route==='purchase');});
  test('Historical and removed gear cannot be enabled by ownership',()=>{const p=profile();for(const id of ['electric-lamp','multitool','wormseed-shot','iron-reliquary']){p.owned[id]=99;p.unlocked.push(id);assert(!E.acquisition(E.byId.get(id),p),id);}});
  test('Owned-only counts cannot be exceeded',()=>{const p=profile();p.acquisition='owned';p.owned['vitality-shot']=1;assert(!E.validate(partial([null,null,'vitality-shot','vitality-shot']),p,false).valid);p.owned['vitality-shot']=2;assert(E.validate(partial([null,null,'vitality-shot','vitality-shot']),p,false).valid);});
  test('Buying-only does not consume owned inventory',()=>{const p=profile();p.acquisition='purchase';p.owned['knife']=3;assert(E.acquisition(E.byId.get('knife'),p).route==='purchase');p.owned.wildland=1;assert(!E.acquisition(E.byId.get('wildland'),p));});
  test('A budget of zero is a real limit',()=>{const p=profile();p.budget=0;assert(!E.generate(p,'zero').ok);});
  test('Fractional quantities and out-of-range ranks are rejected',()=>{const p=profile();p.owned.knife=1.5;assert(!E.generate(p,'bad').ok);p.owned={};p.rank=101;assert(!E.generate(p,'bad').ok);});
  test('15 trait slots enforced',()=>{const p=profile();p.traits=E.data.traits.slice(0,16).map(t=>t.id);assert(!E.generate(p,'too-many').ok);});
  test('Fanning is not applied to Officer or LeMat Carbine',()=>{const p=profile();p.traits=['fanning'];assert(E.activeSynergies(E.byId.get('conversion'),p).includes('fanning'));assert(!E.activeSynergies(E.byId.get('officer'),p).includes('fanning'));assert(!E.activeSynergies(E.byId.get('lemat-carbine'),p).includes('fanning'));});
  test('Assailant excludes Spear; Poacher excludes Satchel',()=>{const p=profile();p.traits=['assailant','poacher'];assert(!E.activeSynergies(E.byId.get('throwing-spear'),p).includes('assailant'));assert(!E.activeSynergies(E.byId.get('dark-dynamite-satchel'),p).includes('poacher'));});
  test('Frontiersman two-use bonus requires solo AND Catalyst',()=>{const p=profile(),kit=E.byId.get('first-aid-kit');p.traits=['frontiersman'];assert(E.benefits(kit,p).some(s=>s.includes('+1 tool')));p.traits.push('catalyst');assert(E.benefits(kit,p).some(s=>s.includes('+2 tool')));p.team='duo';assert(E.benefits(kit,p).some(s=>s.includes('+1 tool')));assert(E.capacity(p)===5);});
  test('Doctor changes medkit note to 100 health',()=>{const p=profile();p.traits=['doctor'];assert(E.benefits(E.byId.get('first-aid-kit'),p).includes('Doctor: 100 HP per use'));});
  test('Seeded rolls reproduce the same hand',()=>{const p=profile();assert(JSON.stringify(E.generate(p,'same-seed').slots)===JSON.stringify(E.generate(p,'same-seed').slots));});
  test('Size-five weapon is generated with an empty secondary',()=>{const p=profile();p.unlocked=['nitro-express'];const result=E.generate(p,'big');assert(result.ok,JSON.stringify(result.errors));assert(result.slots[0]==='nitro-express'&&result.slots[1]===null);});
  test('Held items survive a reroll; invalid held capacity is rejected',()=>{const p=profile();p.traits=['quartermaster'];const held=partial(['mosin-nagant','dolch-96']);const result=E.generate(p,'locked',held);assert(result.ok);assert(result.slots[0]===held[0]&&result.slots[1]===held[1]);p.traits=[];assert(!E.generate(p,'lost-trait',held).ok);});
  test('Full locked valid hand is returned unchanged',()=>{const p=profile();const initial=E.generate(p,'all-held');assert(initial.ok);assert(JSON.stringify(initial.slots)===JSON.stringify(E.generate(p,'other',initial.slots).slots));});
  test('Owned-only complete build costs zero and uses exact inventory',()=>{const p=profile();const initial=E.generate(p,'inventory');assert(initial.ok);p.acquisition='owned';p.budget=0;for(const id of initial.slots.filter(Boolean))p.owned[id]=(p.owned[id]||0)+1;const result=E.generate(p,'owned');assert(result.ok,JSON.stringify(result.errors));assert(result.cost===0);});
  test('Budget-constrained playable build remains affordable',()=>{const p=profile();p.unlocked=['conversion'];p.budget=300;const result=E.generate(p,'cheap');assert(result.ok,JSON.stringify(result.errors));assert(result.cost<=300&&result.slots.includes('first-aid-kit'));});
  test('Excluding every melee option makes playable mode fail clearly',()=>{const p=profile();p.unlocked=['conversion'];p.excluded=E.data.items.filter(i=>i.melee).map(i=>i.id);const result=E.generate(p,'no-melee');assert(!result.ok);});
  test('500 seeded rolls satisfy independent equip constraints',()=>{
    const p=profile();const hands=new Set();
    for(let n=0;n<500;n++){
      p.mode=n%2?'chaos':'playable';p.traits=n%3?['quartermaster','fanning','frontiersman']:[];p.rank=[1,17,33,58,100][n%5];
      const result=E.generate(p,`sweep-${n}`);assert(result.ok,JSON.stringify(result.errors));const items=result.slots.filter(Boolean).map(id=>E.byId.get(id));
      assert(items.filter(i=>i.kind==='weapon').reduce((sum,i)=>sum+i.capacity,0)<=(p.traits.includes('quartermaster')?6:5));
      const tools=items.filter(i=>i.kind==='tool');assert(new Set(tools.map(i=>i.id)).size===tools.length);
      assert(tools.filter(i=>['Melee','Throwable Melee'].includes(i.group)).length<=2,'Too many melee tools');
      assert(items.filter(i=>i.kind!=='weapon').length===8);
      for(const cat of ['throwables','shots','placeables','tarot-cards'])assert(items.filter(i=>i.kind==='consumable'&&i.category===cat).length<=4);
      assert(items.every(i=>i.kind==='weapon'?p.unlocked.includes(i.id):i.requirements.bloodlineRank<=p.rank));
      if(p.mode==='playable')assert(items.some(i=>i.id==='first-aid-kit')&&items.some(i=>i.melee));
      hands.add(result.slots.join(','));
    }
    assert(hands.size>490,'Insufficient variety');
  });
  test('Slot rerolls change only the selected position and preserve the input',()=>{
    const p=profile();p.mode='crazy';const hand=E.generate(p,'slot-original').slots,original=JSON.stringify(hand);
    for(let n=0;n<10;n++){
      const result=E.rerollSlot(p,'slot-'+n,hand,n);
      if(result.ok){assert(result.slots[n]!==hand[n]);assert(result.slots.every((id,i)=>i===n||id===hand[i]));assert(E.validate(result.slots,p).valid);}
      assert(JSON.stringify(hand)===original);
    }
    const result=E.rerollSlot(p,'repeat',hand,2);assert(result.ok);assert(JSON.stringify(result.slots)===JSON.stringify(E.rerollSlot(p,'repeat',hand,2).slots));
  });
  test('Playable medkit cannot be replaced if no legal alternative exists',()=>{
    const p=profile(),hand=E.generate(p,'keep-kit').slots;const index=hand.indexOf('first-aid-kit');
    assert(!E.rerollSlot(p,'replace-kit',hand,index).ok);assert(hand[index]==='first-aid-kit');
    assert(!E.rerollSlot(p,'bad-index',hand,10).ok);
  });
  test('Go Crazy ignores flavor and trait bias while preserving constraints',()=>{
    const p=profile();p.mode='crazy';p.traits=['fanning'];
    const original=E.generate(p,'wild');p.theme='quiet';p.preferTraits=false;
    assert(JSON.stringify(original.slots)===JSON.stringify(E.generate(p,'wild').slots));
    for(let n=0;n<75;n++){p.rank=[1,33,100][n%3];p.budget=800;const result=E.generate(p,'wild-'+n);assert(result.ok,'wild-'+n+': '+JSON.stringify(result.errors));assert(E.validate(result.slots,p).valid);assert(result.cost<=800);}
  });
  test('Squad challenges constrain generation and reject conflicting roles',()=>{
    const p=profile();p.mode='crazy';
    for(const challenge of ['no-scopes','bows','budget300']){p.challenge=challenge;for(let n=0;n<12;n++){const result=E.generate(p,'challenge-'+challenge+n);assert(result.ok,JSON.stringify(result.errors));assert(E.validate(result.slots,p).valid);if(challenge==='bows')assert(result.slots[0]==='hunting-bow');if(challenge==='budget300')assert(result.cost<=300);if(challenge==='no-scopes')assert(result.slots.every(id=>!id||!/sniper|marksman|deadeye|bullseye|sharpeye/.test(id)));}}
    p.challenge='no-scopes';p.role='sniper';assert(!E.generate(p,'conflict').ok);
  });
  test('Roles guarantee suitable primary weapons',()=>{const p=profile();for(const role of ['sniper','close','support']){p.role=role;const result=E.generate(p,'role-'+role);assert(result.ok);const primary=E.byId.get(result.slots[0]);if(role==='sniper')assert(/sniper|marksman|deadeye|bullseye|sharpeye/.test(primary.id));if(role==='close')assert(primary.ammo==='Shells'||primary.ammo===null);}});
  test('Mild chaos keeps essentials and Cursed remains legal',()=>{const p=profile();p.mode='crazy';for(const intensity of ['mild','unhinged','cursed']){p.intensity=intensity;for(let n=0;n<20;n++){const r=E.generate(p,intensity+n);assert(r.ok);assert(E.validate(r.slots,p).valid);if(intensity==='mild')assert(r.slots.includes('first-aid-kit')&&r.slots.some(id=>E.byId.get(id)?.melee));}}});
  test('Item bans apply to rolls, held items and slot rerolls',()=>{const p=profile();const r=E.generate(p,'ban-start');p.excluded=[r.slots[0]];const next=E.generate(p,'ban-next');assert(next.ok&&!next.slots.includes(p.excluded[0]));assert(!E.generate(p,'ban-held',r.slots).ok);assert(!E.rerollSlot(p,'ban-slot',r.slots,2).ok);});
  test('Ammo catalog excludes scarce and split-pool types',()=>{assert(Object.keys(E.data.ammo.weapons).length===91);for(const [id,options] of Object.entries(E.data.ammo.weapons)){assert(E.byId.has(id));for(const a of options){assert(Number.isInteger(a.cost)&&a.cost>=0&&a.source.startsWith('https://'));assert(!/dumdum|explosive|spitzer|frag/i.test(a.name));}}assert(!E.data.ammo.weapons['romero-77']&&!E.data.ammo.weapons['lemat']);assert(E.ammoOption('conversion','fmj-ammo').cost===50);});
  test('Custom ammo respects compatibility budget and held weapon ammo',()=>{
    const p=profile();p.acquisition='purchase';p.customAmmo=true;p.unlocked=['conversion'];
    const build={slots:Array(10).fill(null),locks:Array(10).fill(false),ammo:[null,null]};
    let selected;
    for(let n=0;n<30;n++){const r=E.generateKit(p,'ammo-'+n,build);assert(r.ok);assert(E.validateKit(r.slots,p,r.ammo).valid);if(r.ammo.some(Boolean)){selected=r;break;}}
    assert(selected,'Custom ammo never rolled');
    const v=E.validateKit(selected.slots,p,selected.ammo),base=E.validate(selected.slots,p);assert(v.cost===base.cost+selected.ammo.filter(Boolean).length*50);
    const held={slots:selected.slots,locks:[true,true,...Array(8).fill(false)],ammo:selected.ammo};
    const next=E.generateKit(p,'ammo-held',held);assert(next.ok&&JSON.stringify(next.ammo)===JSON.stringify(selected.ammo));
    p.budget=base.cost;assert(!E.validateKit(selected.slots,p,selected.ammo).valid);
    p.budget=null;assert(!E.validateKit(selected.slots,p,['slug',null]).valid);
    const r=E.rerollKit(p,'equipment-only',held,3);if(r.ok)assert(JSON.stringify(r.ammo)===JSON.stringify(held.ammo));
    p.budget=300;p.challenge='budget300';for(let n=0;n<10;n++){const result=E.generateKit(p,'ammo-budget'+n,build);assert(result.ok);assert(result.cost<=300);}
  });
  test('Unique squad generation respects teammate weapons and held conflicts',()=>{
    const p=profile();const empty=()=>({slots:Array(10).fill(null),locks:Array(10).fill(false),ammo:[null,null]});
    for(let n=0;n<8;n++){const r=E.generateSquad([p,p,p],[empty(),empty(),empty()],'unique-'+n,true);assert(r.ok,JSON.stringify(r.errors));assert(E.uniqueWeapons(r.results));}
    const r=E.generateKit(p,'held-unique',empty());assert(r.ok);const held={...r,locks:Array(10).fill(true)};
    assert(!E.generateSquad([p,p],[held,held],'duplicate-holds',true).ok);
    assert(!E.generateSquad([{...p,challenge:'bows'},{...p,challenge:'bows'}],[empty(),empty()],'bows-unique',true).ok);
  });
  test('Ammo-only reroll changes ammunition and respects holds and budget',()=>{
    const p=profile();p.acquisition='purchase';p.customAmmo=true;p.unlocked=['conversion'];
    const b=E.generateKit(p,'ammo-only',{slots:Array(10).fill(null),locks:Array(10).fill(false),ammo:[null,null]});assert(b.ok);b.locks=Array(10).fill(false);
    const before=JSON.stringify(b);const r=E.rerollAmmo(p,'ammo-only-next',b,0);assert(r.ok,JSON.stringify(r.errors));assert(r.ammo[0]!==b.ammo[0]&&r.ammo[1]===b.ammo[1]);assert(JSON.stringify(b)===before);assert(E.validateKit(b.slots,p,r.ammo).valid);
    b.locks[0]=true;assert(!E.rerollAmmo(p,'held',b,0).ok);b.locks[0]=false;b.ammo=[null,null];p.budget=E.validate(b.slots,p).cost;assert(!E.rerollAmmo(p,'budget',b,0).ok);
  });
  test('Roulette ordering is seeded and includes each challenge once',()=>{const a=E.rouletteOrder('roulette');assert(JSON.stringify(a)===JSON.stringify(E.rouletteOrder('roulette')));assert(a.slice().sort().join(',')==='bows,budget300,no-scopes');});
  test('Mulligans remove exactly one item, preserve other slots and use weighted seeded losses',()=>{
    const p=profile(), empty={slots:Array(10).fill(null),locks:Array(10).fill(false),ammo:[null,null]};
    const b={...E.generateKit(p,'mulligan-base',empty),locks:empty.locks};assert(b.ok);
    const before=JSON.stringify(b);let weapons=0,equipment=0;
    for(let n=0;n<500;n++){
      const r=E.mulliganKit(p,'loss-'+n,b,3);assert(r.ok,JSON.stringify(r.errors));
      assert(r.slots.filter(Boolean).length===b.slots.filter(Boolean).length-1);
      assert(r.slots.every((id,i)=>i===3||i===r.removed.index||id===b.slots[i]));
      assert(!r.slots[r.removed.index]&&!r.locks[r.removed.index]);
      if(r.removed.index<2){weapons++;assert(r.ammo[r.removed.index]===null);}else equipment++;
      assert(E.validateKit(r.slots,{...p,mulligan:true},r.ammo).valid);
    }
    assert(weapons>0&&equipment>weapons*10);assert(JSON.stringify(b)===before);
    assert(JSON.stringify(E.mulliganKit(p,'same',b,3))===JSON.stringify(E.mulliganKit(p,'same',b,3)));
    b.locks[3]=true;assert(!E.mulliganKit(p,'held',b,3).ok);
  });
  test('Repeated mulligans exhaust the hand, cannot refill losses and reset on a fresh deal',()=>{
    let p={...profile(),customAmmo:true},b={...E.generateKit(p,'repeat-base',{slots:Array(10).fill(null),locks:Array(10).fill(false),ammo:[null,null]}),locks:Array(10).fill(false)};
    const count=b.slots.filter(Boolean).length;
    for(let n=0;n<count;n++){
      const i=b.slots.findIndex(Boolean),r=E.mulliganKit(p,'repeat-'+n,b,i);assert(r.ok,JSON.stringify(r.errors));
      b=r;p={...p,mulligan:true};
      assert(b.slots.filter(Boolean).length===count-n-1);
      assert(!E.rerollKit(p,'no-refill',b,b.removed.index).ok);
    }
    assert(!E.mulliganKit(p,'empty',b,0).ok);
    const fresh=E.generateKit(p,'fresh-after-loss',b);assert(fresh.ok&&E.validateKit(fresh.slots,{...p,mulligan:false},fresh.ammo).valid);
  });
  const failed=results.filter(r=>!r.pass);
  document.getElementById('results').textContent=JSON.stringify({passed:results.length-failed.length,failed:failed.length,results},null,2);
  document.body.dataset.status=failed.length?'FAIL':'PASS';
  document.title=`${failed.length?'FAIL':'PASS'} — ${results.length} Chaos engine tests`;
})();
