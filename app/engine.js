(function (global) {
  'use strict';
  const data = global.HUNT_DATA;
  const byId = new Map(data.items.map(item => [item.id, item]));
  const traitById = new Map(data.traits.map(trait => [trait.id, trait]));
  const restricted = item => item.requirements.excludedUntilReviewed || !['standard-candidate', 'event-unlock-required', 'scarce-owned-only'].includes(item.availability);
  function defaults() {
    return {rank: 1, budget: null, acquisition: 'mixed', mode: 'playable', team: 'solo',
      traits: [], unlocked: [], owned: {}, excluded: [], preferTraits: true, theme: 'anything', intensity:'unhinged', challenge:'none', role:'any', customAmmo:false,uniqueWeapons:false,revealAnimation:true};
  }
  function profileErrors(p) {
    const errors = [];
    if (!Number.isInteger(p.rank) || p.rank < 1 || p.rank > 100) errors.push('Bloodline rank must be between 1 and 100.');
    if (p.budget !== null && (!Number.isInteger(p.budget) || p.budget < 0)) errors.push('Enter a whole-number spending limit, or leave it empty.');
    if (!['mixed', 'purchase', 'owned'].includes(p.acquisition)) errors.push('Choose how to acquire your gear.');
    if (!['chaos', 'playable', 'crazy'].includes(p.mode)) errors.push('Choose a loadout mode.');
    if (!['solo', 'duo', 'trio'].includes(p.team)) errors.push('Choose a team size.');
    if (!['anything', 'cowboy', 'quiet', 'close', 'traps'].includes(p.theme)) errors.push('Choose a supported flavor.');
    if (!['mild','unhinged','cursed'].includes(p.intensity||'unhinged')) errors.push('Choose a chaos intensity.');
    if (!['none','no-scopes','bows','budget300'].includes(p.challenge||'none')) errors.push('Choose a squad challenge.');
    if (!['any','sniper','close','support'].includes(p.role||'any')) errors.push('Choose a hunter role.');
    if (!Array.isArray(p.traits) || p.traits.some(t => !traitById.has(t)) || new Set(p.traits).size !== p.traits.length || p.traits.length > 15) errors.push('Select up to 15 distinct equipped traits.');
    if (!Array.isArray(p.unlocked) || !Array.isArray(p.excluded) || !p.owned || typeof p.owned !== 'object') errors.push('Your arsenal settings need to be reset.');
    else if (Object.values(p.owned).some(n => !Number.isInteger(n) || n < 0 || n > 99)) errors.push('Owned quantities must be whole numbers from 0 to 99.');
    return errors;
  }
  const capacity = p => p.traits.includes('quartermaster') ? data.rules.weaponCapacity.withQuartermaster : data.rules.weaponCapacity.default;
  function canBuy(item, p) {
    if (restricted(item) || item.price === null || p.acquisition === 'owned') return false;
    const requirement = item.requirements;
    if (requirement.purchaseRoute === 'bloodline-rank') return p.rank >= requirement.bloodlineRank;
    if (['arsenal-unlock-confirmation', 'event-unlock'].includes(requirement.purchaseRoute)) return p.unlocked.includes(item.id);
    return false;
  }
  function acquisition(item, p, copyNumber = 1) {
    const identity = item.baseId || item.id;
    if (p.excluded.some(id => (byId.get(id)?.baseId || id) === identity)) return null;
    if (item.dual) {
      const base = byId.get(item.baseId);
      const first = acquisition(base,p,copyNumber), second = acquisition(base,p,copyNumber+1);
      return first && second ? {route:first.route===second.route?first.route:'purchase',cost:first.cost+second.cost} : null;
    }
    if (restricted(item) || p.excluded.includes(item.id)) return null;
    if (p.challenge==='no-scopes' && /sniper|marksman|deadeye|bullseye|sharpeye/.test(item.id)) return null;
    if (p.acquisition !== 'purchase' && (p.owned[item.id] || 0) >= copyNumber) return {route: 'owned', cost: 0};
    if (canBuy(item, p)) return {route: 'purchase', cost: item.price};
    return null;
  }
  function measure(slots, p) {
    const count = {}, categories = {}, routes = [];
    let cost = 0, usedCapacity = 0, equipmentCount = 0, meleeTools = 0;
    const errors = [];
    slots.forEach((id, index) => {
      if (!id) { routes[index] = null; return; }
      const item = byId.get(id);
      if (!item) { errors.push('This build contains an unknown item.'); return; }
      if ((index < 2) !== (item.kind === 'weapon')) errors.push(`${item.name} is in the wrong kind of slot.`);
      const identity = item.baseId || id, copies = (count[identity] || 0) + 1;
      count[identity] = copies + (item.dual ? 1 : 0);
      const route = acquisition(item, p, copies);
      if (!route) errors.push(`${item.name}: confirm an unlock or an available owned copy, or remove its exclusion.`);
      routes[index] = route;
      if (route) cost += route.cost;
      if (item.kind === 'weapon') usedCapacity += item.capacity;
      else {
        equipmentCount++;
        if (item.kind === 'tool' && item.melee) meleeTools++;
        if (item.kind === 'tool' && copies > 1) errors.push(`Only one ${item.name} tool can be equipped.`);
        if (item.kind === 'consumable') {
          if (!(item.category in data.rules.consumableCategoryLimits)) errors.push(`${item.name} has an unverified equipment category.`);
          else categories[item.category] = (categories[item.category] || 0) + 1;
        }
      }
    });
    if (usedCapacity > capacity(p)) errors.push(`Weapon capacity is ${usedCapacity}/${capacity(p)}. Change a weapon or equip Quartermaster if it fits a capacity of 6.`);
    if (equipmentCount > data.rules.equipmentPositions) errors.push('There are only eight equipment slots.');
    if (meleeTools > 2) errors.push('Chaos loadouts allow at most two melee tools. Release a held melee tool to roll again.');
    Object.entries(categories).forEach(([category, n]) => {
      if (n > data.rules.consumableCategoryLimits[category]) errors.push(`At most four ${category.replace('-', ' ')} consumables may be equipped.`);
    });
    const limit=spendLimit(p);
    if (limit !== null && cost > limit) errors.push(`New purchases cost $${cost}; your limit is $${limit}.`);
    if (slots[0] && !primaryFits(byId.get(slots[0]),p)) errors.push('Your primary weapon does not fit this hunter role or squad challenge.');
    return {errors: [...new Set(errors)], cost, usedCapacity, equipmentCount, meleeTools, categories, routes, count};
  }
  function validate(slots, p, complete = true) {
    const errors = profileErrors(p);
    if (errors.length) return {valid: false, errors};
    if (!Array.isArray(slots) || slots.length !== 10) return {valid: false, errors: ['A build must contain two weapon positions and eight equipment positions.']};
    const result = measure(slots, p);
    if (complete && !p.mulligan) {
      if (!slots[0] && !slots[1]) result.errors.push('Choose at least one weapon.');
      if (result.equipmentCount !== 8) result.errors.push('Fill all eight equipment slots to complete this contract.');
      if (needsBasics(p)) {
        if (!slots.includes('first-aid-kit')) result.errors.push('Playable mode requires a First Aid Kit.');
        if (!slots.some(id => byId.get(id)?.melee)) result.errors.push('Playable mode requires a melee option.');
      }
      if (p.challenge==='bows' && !slots.includes('hunting-bow')) result.errors.push('The bow challenge requires a Hunting Bow on every hunter.');
    }
    return {...result, valid: result.errors.length === 0};
  }
  function randomFromSeed(seed) {
    let state = 2166136261;
    for (const char of String(seed)) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
    return () => {state += 0x6D2B79F5; let t = Math.imul(state ^ state >>> 15, 1 | state); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296;};
  }
  function activeSynergies(item, p) { return item.synergies.filter(id => p.traits.includes(id)); }
  const needsBasics=p=>p.mode==='playable'||(p.mode==='crazy'&&p.intensity==='mild');
  const spendLimit=p=>p.challenge==='budget300'?Math.min(p.budget??300,300):p.budget;
  function primaryFits(item,p){
    if(!item)return false;
    if(p.challenge==='bows' && item.id!=='hunting-bow')return false;
    if(p.role==='sniper')return /sniper|marksman|deadeye|bullseye|sharpeye/.test(item.id);
    if(p.role==='close')return item.ammo==='Shells'||item.ammo===null;
    return true;
  }
  function weight(item, p, slots) {
    const support=p.role==='support'&&/first-aid|medical|ammo-box|choke|vitality|regeneration/.test(item.id)?5:1;
    if (p.mode === 'crazy') {
      // Ignore comfort preferences and favour eccentric weapons and utility gear.
      const bias={mild:3,unhinged:8,cursed:24}[p.intensity||'unhinged'];
      let wild = item.kind === 'weapon'
        ? (item.ammo===null || /bow|lance|launcher|harpoon/.test(item.id) ? bias : 1)
        : (/decoy|beetle|trap|trip-mine|chaos|concertina|flare|fusee|derringer/.test(item.id) ? bias : 1);
      if (slots.includes(item.id)) wild *= item.kind === 'consumable' ? (p.intensity==='cursed'?8:2) : 0.25;
      return wild*support;
    }
    let w = 1;
    if (p.preferTraits) w += activeSynergies(item, p).length * 3;
    if (p.theme === 'cowboy' && (item.synergies.includes('levering') || item.synergies.includes('fanning') || /dynamite/.test(item.id))) w *= 4;
    if (p.theme === 'quiet' && /silencer|bow|throwing|knife|dusters/.test(item.id)) w *= 4;
    if (p.theme === 'close' && (item.ammo === 'Shells' || item.melee)) w *= 4;
    if (p.theme === 'traps' && /trap|trip-mine|concertina/.test(item.id)) w *= 5;
    if (slots.includes(item.id)) w *= 0.25;
    return w*support;
  }
  function generate(p, seed, locks = Array(10).fill(null)) {
    p={...p,budget:spendLimit(p)};
    const errors = profileErrors(p);
    if (errors.length) return {ok: false, errors};
    if (!Array.isArray(locks) || locks.length !== 10) return {ok: false, errors: ['The locked slots are invalid. Clear locks and try again.']};
    const base = locks.map(id => id || null);
    const lockedCheck = validate(base, p, false);
    if (!lockedCheck.valid) return {ok: false, errors: ['A locked item no longer fits these settings.', ...lockedCheck.errors]};
    const rng = randomFromSeed(seed);
    const weaponPool = data.items.filter(i => i.kind === 'weapon' && acquisition(i, p));
    const equipmentPool = data.items.filter(i => i.kind !== 'weapon' && acquisition(i, p));
    if (!weaponPool.length) return {ok: false, errors: ['Confirm at least one weapon in My Arsenal, or enter an owned weapon quantity.']};
    if (!equipmentPool.length) return {ok: false, errors: ['No equipment is available. Check your Bloodline rank, exclusions, or owned quantities.']};
    const familyCounts = {};
    weaponPool.forEach(i => familyCounts[i.family] = (familyCounts[i.family] || 0) + 1);
    let nodes = 0, exhausted = false;
    const maxNodes = 75000;
    function ordered(pool, slots) {
      return pool.map(item => ({item, key: -Math.log(Math.max(rng(), 1e-10)) / (weight(item, p, slots) / (item.kind === 'weapon' ? familyCounts[item.family] : 1))})).sort((a,b) => a.key - b.key).map(x => x.item);
    }
    function search(slots, allowEmptySecondary) {
      if (++nodes > maxNodes) { exhausted = true; return null; }
      const state = measure(slots, p);
      if (state.errors.length) return null;
      let index = slots.findIndex((id, n) => n < 2 && !id && !(allowEmptySecondary && n === 1));
      if (index === -1) index = slots.findIndex((id, n) => n >= 2 && !id);
      if (index === -1) return validate(slots, p).valid ? slots.slice() : null;
      let pool = index < 2 ? weaponPool : equipmentPool;
      if(index===0)pool=pool.filter(item=>primaryFits(item,p));
      if (index >= 2 && needsBasics(p)) {
        if (!slots.includes('first-aid-kit')) pool = pool.filter(i => i.id === 'first-aid-kit');
        else if (!slots.some(id => byId.get(id)?.melee)) pool = pool.filter(i => i.melee);
      }
      pool = pool.filter(item => {
        if (item.kind === 'weapon' && state.usedCapacity + item.capacity > capacity(p)) return false;
        if (item.kind === 'tool' && state.count[item.id]) return false;
        if (item.kind === 'tool' && item.melee && state.meleeTools >= 2) return false;
        if (item.kind === 'consumable' && (!(item.category in data.rules.consumableCategoryLimits) || (state.categories[item.category] || 0) >= 4)) return false;
        const route = acquisition(item, p, (state.count[item.baseId || item.id] || 0) + 1);
        return route && (p.budget === null || state.cost + route.cost <= p.budget);
      });
      if (!pool.length) {
        if (index === 1 && !base[1] && slots[0]) return search(slots, true);
        return null;
      }
      // An optimistic lower bound prunes unaffordable branches without excluding a valid build.
      if (p.budget !== null) {
        const remainingEquipment = slots.slice(2).filter(id => !id).length;
        const possibleCosts = equipmentPool.flatMap(item => {
          const used=state.count[item.id]||0;
          const copies=item.kind==='tool'?(used?0:1):Math.max(0,4-(state.categories[item.category]||0));
          return Array.from({length:copies},(_,n)=>acquisition(item,p,used+n+1)?.cost).filter(cost=>cost!==undefined);
        }).sort((a,b)=>a-b);
        if (possibleCosts.length<remainingEquipment || state.cost+possibleCosts.slice(0,remainingEquipment).reduce((sum,cost)=>sum+cost,0)>p.budget) return null;
      }
      for (const item of ordered(pool, slots)) {
        slots[index] = item.id;
        const result = search(slots, allowEmptySecondary);
        slots[index] = null;
        if (result) return result;
        if (exhausted) return null;
      }
      return null;
    }
    let result = search(base.slice(), false);
    // Size-five guns and tight budgets can legally leave one weapon position empty.
    if (!result && !exhausted && !base[1]) result = search(base.slice(), true);
    if (!result) return {ok: false, errors: [exhausted ? 'The search reached its limit without finding a build. Try another seed, raise your budget, or release a lock.' : 'No complete build fits these settings. Check your budget, owned quantities, locked items, and playable-mode requirements.'], nodes};
    const validation = validate(result, p);
    if (!validation.valid) return {ok: false, errors: validation.errors};
    return {ok: true, slots: result, seed: String(seed), ...validation, nodes};
  }
  function rerollSlot(p, seed, slots, index) {
    if (!Number.isInteger(index) || index < 0 || index >= 10) return {ok:false,errors:['Choose a valid slot.']};
    if (p.mulligan && !slots[index]) return {ok:false,errors:['Lost slots stay empty until a fresh hunter or squad roll.']};
    const current = validate(slots,p);
    if (!current.valid) return {ok:false,errors:['Deal a valid loadout before rerolling a slot.',...current.errors]};
    const rng = randomFromSeed(seed);
    const candidates = data.items.filter(item => (index < 2) === (item.kind === 'weapon') && item.id !== slots[index])
      .map(item => {
        const next=slots.slice();next[index]=item.id;
        return {item,slots:next,validation:validate(next,p)};
      }).filter(candidate=>candidate.validation.valid);
    if (!candidates.length) return {ok:false,errors:['No different item fits this slot while keeping the other nine slots unchanged. Try another slot or change the mode.']};
    const remaining=slots.map((id,n)=>n===index?null:id);
    const chosen=candidates.map(candidate=>({...candidate,key:-Math.log(Math.max(rng(),1e-10))/weight(candidate.item,p,remaining)})).sort((a,b)=>a.key-b.key)[0];
    return {ok:true,slots:chosen.slots,seed:String(seed),...chosen.validation};
  }
  function benefits(item, p) {
    const notes = activeSynergies(item, p).map(id => traitById.get(id).name);
    if (p.traits.includes('frontiersman') && item.limitedTool) {
      const extra = p.team === 'solo' && p.traits.includes('catalyst') ? 2 : 1;
      let text = `+${extra} tool use${extra > 1 ? 's' : ''}`;
      if (item.id === 'quad-derringer') text = `+${extra * 4} reserve shots`;
      if (item.id === 'derringer-pennyshot') text = `+${extra * 2} reserve shells`;
      notes[notes.indexOf('Frontiersman')] = `Frontiersman: ${text}`;
    }
    if (item.id === 'first-aid-kit' && p.traits.includes('doctor')) notes[notes.indexOf('Doctor')] = 'Doctor: 100 HP per use';
    return notes;
  }
  global.ChaosEngine = {data, byId, traitById, defaults, restricted, capacity, canBuy, acquisition, validate, generate, rerollSlot, activeSynergies, benefits, profileErrors};
})(window);
