"""Check choice card rendering and Tarot Don't Own using the standalone build."""
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent.parent

with sync_playwright() as playwright:
    executable = os.environ.get('BROWSER_EXECUTABLE')
    browser = playwright.chromium.launch(headless=True, **({'executable_path': executable} if executable else {}))
    page = browser.new_page(viewport={'width': 1440, 'height': 1100})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto((ROOT / 'Chaos-Loadout.html').as_uri())
    page.evaluate('''() => {
      const E=ChaosEngine, state=ChaosApp.getSharedState();
      Object.assign(state.profile,{rank:100,singleRerolls:true,revealAnimation:false});
      const build=state.builds[0];
      Object.assign(build,{rank:100,lastSeed:'choice-ui',dirty:false});
      build.slots=['wold-card-weapon',null,'wold-card-equipment','any-tarot',null,null,null,null,null,null];
      build.locks=build.slots.map(Boolean);
      const result=E.generateKit({...state.profile,unlocked:E.data.items.filter(E.eligibleWeapon).map(i=>i.id)},'choice-ui',build);
      if(!result.ok)throw Error(JSON.stringify(result.errors));
      Object.assign(build,result);
      build.locks[3]=false;
      ChaosApp.applySharedState(state);
    }''')
    expect(page.locator('h3').filter(has_text='Wild Card')).to_have_count(2)
    expect(page.locator('h3').filter(has_text='Wold Card')).to_have_count(0)
    expect(page.locator('.card-price').filter(has_text='YOUR PICK')).to_have_count(3)
    assert page.locator('.equipment-image').evaluate_all('(images)=>images.every(img=>img.complete&&img.naturalWidth>0)')
    button = page.locator('[data-dont-own="3"][data-hunter="0"]')
    expect(button).to_be_enabled()
    before = page.evaluate('ChaosApp.getState().slots')
    button.click()
    page.wait_for_function('ChaosApp.getState().slots[3] !== "any-tarot"')
    after = page.evaluate('ChaosApp.getState().slots')
    assert after[3] and all(a == b for i, (a, b) in enumerate(zip(before, after)) if i != 3)
    assert page.evaluate('ChaosApp.getState().builds[0].unownedTarot') == ['any-tarot']
    page.reload()
    assert page.evaluate('ChaosApp.getState().slots') == after
    assert page.evaluate('ChaosApp.getState().builds[0].unownedTarot') == ['any-tarot']
    (ROOT / 'artifacts').mkdir(exist_ok=True)
    page.screenshot(path=str(ROOT / 'artifacts' / 'choice-cards.png'), full_page=True)
    page.locator('#roll').click()
    page.wait_for_function('ChaosApp.getState().builds[0].unownedTarot.length === 0')
    assert not errors, errors
    browser.close()
print('Choice cards: rename, artwork, Tarot replacement, no item loss, reload and fresh-deal reset passed.')
