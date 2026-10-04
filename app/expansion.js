(function(){
  'use strict';
  const E=window.ChaosEngine;
  const options=weapon=>E.data.ammo.weapons[weapon]||[];
  const standard={id:null,name:'Standard ammo',cost:0};
  const ammoSlots=weapon=>E.data.ammo.slots?.[weapon]||[{name:'Ammo',options:options(weapon).map(a=>a.id)}];
  function ammoOption(weapon,id){
    if(!Array.isArray(id))return id?ammoSlots(weapon)[0].options.includes(id)?options(weapon).find(a=>a.id===id):undefined:standard;
    if(!E.data.ammo.slots?.[weapon])return undefined;
    const pools=ammoSlots(weapon);
    if(id.length!==pools.length)return undefined;
    const choices=id.map((value,n)=>value===null?standard:pools[n].options.includes(value)?options(weapon).find(a=>a.id===value):undefined);
    if(choices.some(a=>!a))return undefined;
    return {id:id.some(Boolean)?id:null,name:choices.map((a,n)=>`${pools[n].name}: ${a.name}`).join(' · '),cost:choices.reduce((sum,a)=>sum+a.cost,0),slots:choices};
  }
  function ammoChoices(weapon,enabled){
    if(!enabled||!options(weapon).length)return [{id:null,weight:1}];
    let choices=[{ids:[],weight:1}];
    for(const pool of ammoSlots(weapon)){
      const values=[{id:null,weight:pool.options.length?0.15:1},...pool.options.map(id=>({id,weight:0.85/pool.options.length}))];
      choices=choices.flatMap(c=>values.map(a=>({ids:[...c.ids,a.id],weight:c.weight*a.weight})));
    }
    return choices.map(c=>({id:c.ids.length===1?c.ids[0]:c.ids,weight:c.weight}));
  }
  function weighted(candidates,seed){let draw=random(seed)()*candidates.reduce((sum,c)=>sum+c.weight,0);return candidates.find(c=>(draw-=c.weight)<0)||candidates.at(-1);}
  function validateKit(slots,p,ammo=[null,null],complete=true){
    const base=E.validate(slots,p,complete),errors=[...base.errors];
    let ammoCost=0;
    if(!Array.isArray(ammo)||ammo.length!==2)errors.push('Ammunition data is invalid.');
    else ammo.forEach((id,n)=>{
      const option=ammoOption(slots[n],id);
      if(!option)errors.push('Ammunition is incompatible with this weapon.');
      else ammoCost+=option.cost;
      if((Array.isArray(id)?id.some(Boolean):id)&&!p.customAmmo)errors.push('Enable unlocked custom ammunition or deal standard ammo.');
    });
    const cost=(base.cost||0)+ammoCost;
    const limit=p.challenge==='budget300'?Math.min(p.budget??300,300):p.budget;
    if(limit!==null&&cost>limit)errors.push(`Equipment and ammunition cost $${cost}; your limit is $${limit}.`);
    return {...base,ammoCost,cost,errors:[...new Set(errors)],valid:!errors.length};
  }
  function random(seed){let n=2166136261;for(const c of String(seed))n=Math.imul(n^c.charCodeAt(0),16777619);n=Math.imul(n^(n>>>16),0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);n^=n>>>16;return ()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967296;};}
  function selectAmmo(slots,p,seed,preserved=[null,null],keep=[false,false]){
    const pools=[0,1].map(i=>keep[i]?[{id:preserved[i],weight:1}]:ammoChoices(slots[i],p.customAmmo));
    const candidates=pools[0].flatMap(a=>pools[1].map(b=>({ammo:[a.id,b.id],weight:a.weight*b.weight}))).filter(c=>validateKit(slots,p,c.ammo).valid);
    return weighted(candidates,seed+':ammo')?.ammo||preserved.map((id,i)=>keep[i]?id:null);
  }
  function generateKit(p,seed,build,blocked=null){
    p={...p,mulligan:!!blocked};
    const keep=build.locks.slice(0,2),ammo=build.ammo||[null,null];
    const heldCost=ammo.reduce((sum,id,n)=>sum+(keep[n]?(ammoOption(build.slots[n],id)?.cost||0):0),0);
    const limit=p.challenge==='budget300'?Math.min(p.budget??300,300):p.budget;
    if(limit!==null&&heldCost>limit)return {ok:false,errors:['Held ammunition exceeds the spending limit.']};
    const result=E.generate({...p,budget:limit===null?null:limit-heldCost},seed,build.slots.map((id,n)=>build.locks[n]?id:null),blocked||Array(10).fill(false));
    if(!result.ok)return result;
    const nextAmmo=selectAmmo(result.slots,p,seed,ammo,keep);
    const validation=validateKit(result.slots,p,nextAmmo);
    return {...result,...validation,ammo:nextAmmo,ok:validation.valid};
  }
  function rerollKit(p,seed,build,index){
    const oldAmmo=build.ammo||[null,null],preserved=oldAmmo.map((id,n)=>n===index?null:id);
    const ammoCost=preserved.reduce((sum,id,n)=>sum+(ammoOption(build.slots[n],id)?.cost||0),0);
    const limit=p.challenge==='budget300'?Math.min(p.budget??300,300):p.budget;
    // Original ammo at the selected weapon can be released to buy its replacement.
    const result=E.rerollSlot({...p,budget:limit===null?null:limit-ammoCost},seed,build.slots,index);
    if(!result.ok)return result;
    const ammo=selectAmmo(result.slots,p,seed,preserved,[index!==0,index!==1]);
    const validation=validateKit(result.slots,p,ammo);
    return {...result,...validation,ammo,ok:validation.valid};
  }
  function mulliganKit(p,seed,build,index){
    if(!Number.isInteger(index)||index<0||index>=10||!build.slots[index]||build.locks[index])return {ok:false,errors:['Choose an occupied, unheld item for a mulligan.']};
    const current=validateKit(build.slots,p,build.ammo);
    if(!current.valid)return {ok:false,errors:current.errors};
    const result=rerollKit({...p,mulligan:true},seed,build,index);
    if(!result.ok)return result;
    const candidates=result.slots.map((id,n)=>({id,index:n,weight:n<2?1:10})).filter(c=>c.id);
    let draw=random(seed+':mulligan-loss')()*candidates.reduce((sum,c)=>sum+c.weight,0);
    const removed=candidates.find(c=>(draw-=c.weight)<0)||candidates[candidates.length-1];
    result.slots[removed.index]=null;
    if(removed.index<2)result.ammo[removed.index]=null;
    const locks=build.locks.slice();locks[removed.index]=false;
    return {...result,...validateKit(result.slots,{...p,mulligan:true},result.ammo),locks,removed,mulligan:true};
  }
  function loadoutMulligan(p,seed,build){
    const uses=build.loadoutMulligans??0,loss=uses+1;
    if(!Number.isInteger(uses)||uses<0||uses>10)return {ok:false,errors:['The loadout mulligan count is invalid.']};
    if(build.slots.filter(Boolean).length<loss)return {ok:false,errors:[`You need ${loss} remaining items to afford this loadout mulligan.`]};
    const current=validateKit(build.slots,p,build.ammo);
    if(!current.valid)return {ok:false,errors:current.errors};
    const result=generateKit(p,seed,build,build.slots.map(id=>!id));
    if(!result.ok)return result;
    const rng=random(seed+':loadout-mulligan-loss'),removed=[],locks=build.locks.slice();
    for(let n=0;n<loss;n++){
      const candidates=result.slots.map((id,index)=>({id,index,weight:index<2?1:10})).filter(c=>c.id);
      let draw=rng()*candidates.reduce((sum,c)=>sum+c.weight,0);
      const item=candidates.find(c=>(draw-=c.weight)<0)||candidates.at(-1);
      result.slots[item.index]=null;locks[item.index]=false;
      if(item.index<2)result.ammo[item.index]=null;
      removed.push(item);
    }
    const validation=validateKit(result.slots,{...p,mulligan:true},result.ammo);
    return {...result,...validation,ok:validation.valid,locks,removed,mulligan:true,loadoutMulligans:loss};
  }
  function uniqueWeapons(builds){const owners=new Map();return builds.every((b,i)=>b.slots.slice(0,2).filter(Boolean).every(id=>{id=E.byId.get(id)?.baseId||id;if(owners.has(id)&&owners.get(id)!==i)return false;owners.set(id,i);return true;}));}
  function generateSquad(profiles,builds,seed,unique=false){
    const held=builds.map(b=>({slots:b.slots.map((id,n)=>n<2&&b.locks[n]?id:null)}));
    if(unique&&!uniqueWeapons(held))return {ok:false,errors:['Two hunters hold the same weapon. Release one hold or disable unique weapons.']};
    let errors=[];
    for(let attempt=0;attempt<(unique?16:1);attempt++){
      const results=[];
      for(let i=0;i<builds.length;i++){
        const taken=unique?[...held.flatMap((b,j)=>j===i?[]:b.slots.filter(Boolean)),...results.flatMap(r=>r.slots.slice(0,2).filter(Boolean))]:[];
        const p={...profiles[i],excluded:[...new Set([...profiles[i].excluded,...taken])]};
        const hunterSeed=(i===0?seed:`${seed}:hunter-${i+1}`)+(attempt?`:retry-${attempt}`:'');
        const r=generateKit(p,hunterSeed,builds[i]);
        if(!r.ok){errors=r.errors.map(e=>`Hunter ${i+1}: ${e}`);break;}
        results.push({...r,seed:hunterSeed});
      }
      if(results.length===builds.length)return {ok:true,results};
    }
    return {ok:false,errors:unique?['No squad with distinct teammate weapons was found. Adjust roles, bans or holds.',...errors]:errors};
  }
  function rouletteOrder(seed){return ['no-scopes','bows','budget300'].map(id=>({id,key:random(seed+':'+id)()})).sort((a,b)=>a.key-b.key).map(x=>x.id);}
  Object.assign(E,{selectAmmo,ammoSlots,ammoOptions:options,ammoOption,validateKit,generateKit,rerollKit,mulliganKit,loadoutMulligan,uniqueWeapons,generateSquad,rouletteOrder});
})();
