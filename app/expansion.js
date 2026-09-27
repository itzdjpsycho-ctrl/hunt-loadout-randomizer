(function(){
  'use strict';
  const E=window.ChaosEngine;
  const options=weapon=>E.data.ammo.weapons[weapon]||[];
  const standard={id:null,name:'Standard ammo',cost:0};
  function ammoOption(weapon,id){return id?options(weapon).find(a=>a.id===id):standard;}
  function validateKit(slots,p,ammo=[null,null],complete=true){
    const base=E.validate(slots,p,complete),errors=[...base.errors];
    let ammoCost=0;
    if(!Array.isArray(ammo)||ammo.length!==2)errors.push('Ammunition data is invalid.');
    else ammo.forEach((id,n)=>{
      const option=ammoOption(slots[n],id);
      if(!option)errors.push('Ammunition is incompatible with this weapon.');
      else ammoCost+=option.cost;
      if(id&&!p.customAmmo)errors.push('Enable unlocked custom ammunition or deal standard ammo.');
    });
    const cost=(base.cost||0)+ammoCost;
    const limit=p.challenge==='budget300'?Math.min(p.budget??300,300):p.budget;
    if(limit!==null&&cost>limit)errors.push(`Equipment and ammunition cost $${cost}; your limit is $${limit}.`);
    return {...base,ammoCost,cost,errors:[...new Set(errors)],valid:!errors.length};
  }
  function random(seed){let n=2166136261;for(const c of String(seed))n=Math.imul(n^c.charCodeAt(0),16777619);return ()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967296;};}
  function selectAmmo(slots,p,seed,preserved=[null,null],keep=[false,false]){
    const rng=random(seed+':ammo'),ammo=preserved.slice();
    for(let i=0;i<2;i++)if(!keep[i])ammo[i]=null;
    for(let i=0;i<2;i++){
      if(keep[i]||!p.customAmmo)continue;
      const candidates=[standard,...options(slots[i])].filter(a=>{const next=ammo.slice();next[i]=a.id;return validateKit(slots,p,next).valid;});
      ammo[i]=candidates[Math.floor(rng()*candidates.length)]?.id||null;
    }
    return ammo;
  }
  function generateKit(p,seed,build){
    p={...p,mulligan:false};
    const keep=build.locks.slice(0,2),ammo=build.ammo||[null,null];
    const heldCost=ammo.reduce((sum,id,n)=>sum+(keep[n]?(ammoOption(build.slots[n],id)?.cost||0):0),0);
    const limit=p.challenge==='budget300'?Math.min(p.budget??300,300):p.budget;
    if(limit!==null&&heldCost>limit)return {ok:false,errors:['Held ammunition exceeds the spending limit.']};
    const result=E.generate({...p,budget:limit===null?null:limit-heldCost},seed,build.slots.map((id,n)=>build.locks[n]?id:null));
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
  function rerollAmmo(p,seed,build,index){
    if(![0,1].includes(index)||!p.customAmmo||build.locks[index])return {ok:false,errors:['Enable custom ammo and release this weapon hold first.']};
    const current=validateKit(build.slots,p,build.ammo);
    if(!current.valid)return {ok:false,errors:current.errors};
    const candidates=[standard,...options(build.slots[index])].filter(a=>a.id!==build.ammo[index]).map(a=>{const ammo=build.ammo.slice();ammo[index]=a.id;return {ammo,validation:validateKit(build.slots,p,ammo)};}).filter(c=>c.validation.valid);
    if(!candidates.length)return {ok:false,errors:['No different compatible ammo fits the budget.']};
    const chosen=candidates[Math.floor(random(seed)()*candidates.length)];
    return {ok:true,ammo:chosen.ammo,...chosen.validation};
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
  Object.assign(E,{ammoOptions:options,ammoOption,validateKit,generateKit,rerollKit,mulliganKit,rerollAmmo,uniqueWeapons,generateSquad,rouletteOrder});
})();
