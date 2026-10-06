"""Check cosmetic slot reels against the built standalone app."""
import os
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=os.environ.get("BROWSER_EXECUTABLE"))
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto((ROOT / "Chaos-Loadout.html").as_uri())
    page.locator("#squad-options-open").click()
    page.locator("#reveal-animation").check()
    page.locator('[data-close="squad-options-dialog"]').first.click()
    page.locator("#roll").click()
    expect(page.locator(".slot-reel").first).to_be_visible()
    result = page.evaluate("""() => {
      const reels=[...document.querySelectorAll('.slot-reel-strip')];
      return reels.map(strip=>{
        const animation=strip.getAnimations()[0];animation.pause();
        const duration=animation.effect.getTiming().duration;
        animation.currentTime=duration*.2;
        const start=new DOMMatrix(getComputedStyle(strip).transform).m42;
        animation.currentTime=duration*.6;
        const end=new DOMMatrix(getComputedStyle(strip).transform).m42;
        return end>start && strip.firstElementChild.textContent===strip.closest('article').querySelector('h3').textContent;
      });
    }""")
    assert result and all(result), "Reels must travel downward and land on the dealt item"
    page.screenshot(path=str(ROOT / "artifacts" / "slot-machine-desktop.png"))
    state = page.evaluate("ChaosApp.getSharedState()")
    page.locator("#skip-reveal").click()
    expect(page.locator(".slot-reel")).to_have_count(0)
    assert page.evaluate("ChaosApp.getSharedState()") == state
    page.locator('[data-lock="0"]').first.click()
    page.locator("#roll").click()
    expect(page.locator("article.held .slot-reel")).to_have_count(0)
    expect(page.locator("#skip-reveal")).to_be_hidden(timeout=6000)
    expect(page.locator(".slot-reel")).to_have_count(0)
    page.emulate_media(reduced_motion="reduce")
    page.locator("#roll").click()
    expect(page.locator(".slot-reel")).to_have_count(0)
    assert not errors, errors
    browser.close()
    print("PASS Downward reels, correct final items, Skip, held items, completion and reduced motion")
