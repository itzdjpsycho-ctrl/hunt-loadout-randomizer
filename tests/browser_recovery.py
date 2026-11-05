"""Verify current-hand Quarter Master and First Aid Kit Buyback lifecycle."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parent.parent
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True, executable_path=os.environ.get('BROWSER_EXECUTABLE'))
    page=browser.new_page(viewport={'width':1440,'height':1100})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto((ROOT/'Chaos-Loadout.html').as_uri())
    page.evaluate('''() => {
      const E=ChaosEngine,s=ChaosApp.getSharedState(),b=s.builds[0];
      Object.assign(s.profile,{rank:100,mode:'chaos',revealAnimation:false});
      Object.assign(b,{rank:100,traits:[],dirty:false,lastSeed:'recovery',locks:Array(10).fill(false),ammo:[null,null],mulligan:false,secondaryLost:false});
      const p={...s.profile,unlocked:E.data.items.filter(E.eligibleWeapon).map(i=>i.id)};
      const primary=E.data.items.find(i=>i.capacity===5&&E.canBuy(i,p));
      b.slots=[primary.id,...Array(9).fill(null)];b.locks[0]=true;
      const r=E.generateKit(p,'recovery',b);if(!r.ok)throw Error(r.errors);
      Object.assign(b,{slots:r.slots,ammo:r.ammo,locks:Array(10).fill(false)});
      ChaosApp.applySharedState(s);
    }''')
    before=page.evaluate('ChaosApp.getState().slots')
    expect(page.locator('[data-quarter-master]')).to_be_enabled()
    page.locator('[data-quarter-master]').click()
    after=page.evaluate('ChaosApp.getState().slots')
    assert after[1] and all(a==b for i,(a,b) in enumerate(zip(before,after)) if i!=1)
    expect(page.locator('#quartermaster')).not_to_be_checked()
    expect(page.locator('#capacity-value')).to_contain_text('/ 6')
    page.reload()
    assert page.evaluate('ChaosApp.getState().slots')==after
    assert page.evaluate('ChaosApp.getState().builds[0].rollQuartermaster')
    assert page.evaluate('ChaosApp.exportObject().validation.valid')
    page.locator('#roll').click()
    page.wait_for_function('!ChaosApp.getState().builds[0].rollQuartermaster')
    expect(page.locator('#capacity-value')).to_contain_text('/ 5')
    page.evaluate('''() => {
      const s=ChaosApp.getSharedState(),b=s.builds[0];
      b.slots=['conversion',null,null,'knuckle-knife','choke-bombs','flare-pistol',null,null,null,null];
      Object.assign(b,{mulligan:true,lostMedkit:2,dirty:false,lastSeed:'lost-kit',ammo:[null,null],locks:Array(10).fill(false)});
      ChaosApp.applySharedState(s);
    }''')
    page.reload()
    expect(page.locator('[data-buyback]')).to_be_enabled()
    before=page.evaluate('ChaosApp.getState().slots')
    page.locator('[data-buyback]').click()
    after=page.evaluate('ChaosApp.getState().slots')
    assert after[2]=='first-aid-kit' and sum(bool(i) for i in after)==sum(bool(i) for i in before)-1
    assert sum(bool(a) and not b for a,b in zip(before,after))==2
    assert after[0]==before[0] and after[1]==before[1]
    expect(page.locator('[data-buyback]')).to_have_count(0)
    page.reload()
    assert page.evaluate('ChaosApp.getState().slots')==after
    assert page.evaluate('ChaosApp.exportObject().validation.valid')
    assert not errors,errors
    browser.close()
print('PASS Quarter Master: secondary-only, trait unchanged, reload, export, fresh-deal reset; Buyback: exact payment, restore, reload.')
