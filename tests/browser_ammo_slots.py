"""Verify single-pool sniper ammo and migration of old saved two-pool choices."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parent.parent
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE'))
    page=browser.new_page(viewport={'width':1440,'height':1100})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto((ROOT/'Chaos-Loadout.html').as_uri())
    page.evaluate('''() => {
      const s=ChaosApp.getSharedState(),b=s.builds[0];
      Object.assign(s.profile,{mode:'chaos',customAmmo:true,revealAnimation:false});
      Object.assign(b,{slots:['centennial-sniper','lemat','first-aid-kit','knife',null,null,null,null,null,null],traits:[],rank:100,mulligan:true,lastSeed:'ammo-migration',dirty:false,locks:[true,...Array(9).fill(false)],ammo:['fmj-ammo',['fmj-ammo','slug']]});
      ChaosApp.applySharedState(s);
      const saved=JSON.parse(localStorage.getItem('dead-mans-hand.v1'));
      saved.builds[0].ammo[0]=['fmj-ammo','poison-ammo'];
      localStorage.setItem('dead-mans-hand.v1',JSON.stringify(saved));
      const entry={...s,id:'old-ammo',label:'Old split sniper',created:'2026-11-06',activeBuild:0};
      entry.builds[0].ammo[0]=['fmj-ammo','poison-ammo'];
      localStorage.setItem('dead-mans-hand.library.v1',JSON.stringify({history:[entry],favorites:[entry]}));
    }''')
    page.reload()
    def check_migration():
        state=page.evaluate('ChaosApp.getState()')
        assert state['builds'][0]['ammo']==[None,['fmj-ammo','slug']]
        assert state['slots'][0]=='centennial-sniper' and state['locks'][0]
        assert not state['dirty'] and page.evaluate('ChaosApp.exportObject().validation.valid')
    check_migration()
    for saved_list in ('favorites','history'):
        page.locator('#library-open').click()
        page.locator(f'[data-restore="old-ammo"][data-list="{saved_list}"]').click()
        check_migration()
    page.evaluate('''() => {
      const s=ChaosApp.getSharedState();s.builds[0].ammo[0]=['fmj-ammo','poison-ammo'];
      ChaosApp.applySharedState(s);
    }''')
    check_migration()
    page.locator('#roll').click()
    page.wait_for_function('ChaosApp.getState().lastSeed!=="ammo-migration"')
    assert page.evaluate('ChaosApp.getState().slots[0]')=='centennial-sniper'
    assert page.evaluate('!Array.isArray(ChaosApp.getState().builds[0].ammo[0])')
    assert page.evaluate('ChaosApp.exportObject().validation.valid')
    for weapon in ('centennial-sniper','infantry-73l-sniper','krag-sniper','mosin-nagant-sniper'):
        page.evaluate('''weapon=>{
          const s=ChaosApp.getSharedState(),b=s.builds[0];
          b.slots[0]=weapon;b.ammo[0]=ChaosEngine.ammoSlots(weapon)[0].options[0];
          b.slots[1]='lemat';b.ammo[1]=['fmj-ammo','slug'];
          b.traits=['quartermaster'];b.dirty=false;
          ChaosApp.applySharedState(s);
        }''',weapon)
        expect(page.locator('.weapon-card').nth(0).locator('.special-ammo-choice')).to_have_count(0)
        expect(page.locator('.weapon-card').nth(1).locator('.special-ammo-choice')).to_have_count(2)
        assert page.evaluate('ChaosApp.exportObject().validation.valid')
    assert not errors,errors
    browser.close()
print('PASS one ammo choice on all four repeating snipers; valid split barrels; reload, history/favorites, shared-state migration and held fresh deal.')
