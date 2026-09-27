"""Real multi-browser checks against a private Uvicorn test process."""

import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)
checks = []


def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)
    print("PASS " + name, flush=True)


def connected(page):
    expect(page.locator("#session-status")).to_contain_text("Connected", timeout=15000)


def shared(page):
    return page.evaluate("ChaosApp.getSharedState()")


def match(page, state):
    page.wait_for_function("""s => {
      const stable = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
      return stable(ChaosApp.getSharedState().builds) === stable(s.builds) && ChaosApp.getSharedState().rollNumber === s.rollNumber;
    }""", arg=state)


with tempfile.TemporaryDirectory(dir=ARTIFACTS) as directory:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    url = f"http://127.0.0.1:{port}/"
    env = {**os.environ, "SESSION_DB": str(Path(directory) / "rooms.db")}
    with open(ARTIFACTS / "session-browser-server.log", "w") as log:
        process = subprocess.Popen([sys.executable, "-m", "uvicorn", "server.main:app", "--host", "127.0.0.1", "--port", str(port)], cwd=ROOT, env=env, stdout=log, stderr=log)
        try:
            for attempt in range(80):
                try:
                    with urlopen(url + "api/health", timeout=1) as response:
                        if response.status == 200:
                            break
                except OSError:
                    time.sleep(0.1)
            else:
                raise RuntimeError("Uvicorn test server did not start")
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True, executable_path=os.environ.get("BROWSER_EXECUTABLE"))
                contexts = [browser.new_context(viewport={"width": 1440, "height": 1000}) for _ in range(4)]
                host, guest, third, extra = [context.new_page() for context in contexts]
                errors = []
                for page in (host, guest, third, extra):
                    page.on("pageerror", lambda error: errors.append(str(error)))
                host.goto(url)
                host.locator("#squad-options-open").click()
                host.locator("#reveal-animation").uncheck()
                host.locator('[data-close="squad-options-dialog"]').first.click()
                host.locator("#session-name").fill("Host")
                host.locator("#session-create").click()
                connected(host)
                code = host.locator("#session-room-code").inner_text().split()[-1]
                guest.goto(url + "#room=" + code)
                expect(guest.locator("#session-code")).to_have_value(code)
                guest.locator("#session-name").fill("Partner")
                guest.locator("#session-join").click()
                connected(guest)
                expect(host.locator("#session-members li")).to_have_count(2)
                check("Two browsers join the same room and get separate hunters", guest.evaluate("ChaosApp.getState().activeBuild") == 1)
                expect(guest.locator("#roll")).to_be_disabled()
                expect(guest.locator('[data-hunter-name="0"]')).to_be_disabled()
                expect(guest.locator('[data-hunter-name="1"]')).to_be_enabled()
                check("Guests can edit only their own hunter", True)
                host.locator("#roll").click()
                host.wait_for_function("ChaosApp.getSharedState().rollNumber === 1")
                connected(host)
                match(guest, shared(host))
                check("Host squad roll synchronizes to another browser", True)
                before = shared(guest)
                guest.locator('[data-mulligan="3"][data-hunter="1"]').click()
                guest.wait_for_function("ChaosApp.getSharedState().rollNumber === 2")
                connected(guest)
                after = shared(guest)
                match(host, after)
                check("Mulligan loss synchronizes without changing teammates", sum(bool(x) for x in after["builds"][1]["slots"]) == sum(bool(x) for x in before["builds"][1]["slots"]) - 1 and after["builds"][0] == before["builds"][0] and after["builds"][2] == before["builds"][2])
                lost = next(i for i, (old, new) in enumerate(zip(before["builds"][1]["slots"], after["builds"][1]["slots"])) if old and not new)
                expect(host.locator(f'[data-reroll="{lost}"][data-hunter="1"]')).to_be_disabled()
                check("Lost slots remain empty on both clients", True)
                seat = next(i for i, value in enumerate(after["builds"][1]["slots"]) if value and i >= 2)
                guest.locator(f'[data-lock="{seat}"][data-hunter="1"]').click()
                connected(guest)
                host.wait_for_function("i => ChaosApp.getSharedState().builds[1].locks[i]", arg=seat)
                check("Holds synchronize", True)
                guest.locator('[data-hunter-name="1"]').fill('Partner <one>')
                guest.locator('[data-hunter-name="1"]').press('Tab')
                host.wait_for_function("ChaosApp.getSharedState().builds[1].name === 'Partner <one>'")
                check("Hunter names synchronize as text", True)
                guest.locator(f'[data-lock="{seat}"][data-hunter="1"]').click()
                host.wait_for_function("i => !ChaosApp.getSharedState().builds[1].locks[i]", arg=seat)
                before_reroll = shared(guest)
                guest.locator(f'[data-reroll="{seat}"][data-hunter="1"]').click()
                guest.wait_for_function("n => ChaosApp.getSharedState().rollNumber === n + 1", arg=before_reroll["rollNumber"])
                match(host, shared(guest))
                after_reroll = shared(host)
                check("Ordinary reroll synchronizes while preserving mulligan losses", after_reroll["builds"][1]["slots"][lost] is None and all(value == before_reroll["builds"][1]["slots"][i] for i, value in enumerate(after_reroll["builds"][1]["slots"]) if i != seat))
                guest.locator('[data-build="0"]').click()
                expect(guest.locator('#quartermaster')).to_be_disabled()
                guest.locator('[data-build="1"]').click()
                expect(guest.locator('#quartermaster')).to_be_enabled()
                check("Trait controls follow the selected hunter's ownership", True)
                guest.reload()
                connected(guest)
                match(guest, shared(host))
                check("Reload reconnects to the same seat and loadout", guest.evaluate("ChaosApp.getState().activeBuild") == 1)
                contexts[1].set_offline(True)
                expect(guest.locator("#session-status")).to_contain_text("Reconnecting", timeout=15000)
                expect(guest.locator('[data-hunter-name="1"]')).to_be_disabled()
                host.locator('[data-mulligan="3"][data-hunter="0"]').click()
                connected(host)
                contexts[1].set_offline(False)
                connected(guest)
                match(guest, shared(host))
                check("Disconnect pauses edits and reconnect restores current room state", True)
                for page, name in ((third, "Third"), (extra, "Extra")):
                    page.goto(url + "#room=" + code)
                    page.locator("#session-name").fill(name)
                    page.locator("#session-join").click()
                connected(third)
                expect(extra.locator("#session-status")).to_contain_text("full")
                check("Room capacity is enforced", True)
                host.screenshot(path=str(ARTIFACTS / "shared-session-desktop.png"), full_page=True)
                contexts[1].pages[0].set_viewport_size({"width": 390, "height": 844})
                check("Shared session controls fit a mobile viewport", guest.evaluate("document.documentElement.scrollWidth <= innerWidth"))
                guest.screenshot(path=str(ARTIFACTS / "shared-session-mobile.png"), full_page=True)
                host.locator("#session-leave").click()
                expect(host.locator("#session-lobby")).to_be_visible()
                expect(guest.locator("#session-status")).to_contain_text("Host")
                expect(guest.locator("#roll")).to_be_enabled()
                check("Host departure transfers control and restores personal squad", host.evaluate("ChaosApp.getState().buildCount") == 1)
                guest.locator("#session-members [data-session-remove]").click()
                expect(third.locator("#session-lobby")).to_be_visible(timeout=15000)
                check("Host can remove a player and the removed browser leaves", True)
                check("No browser JavaScript exceptions", not errors)
                browser.close()
        finally:
            process.terminate()
            process.wait(timeout=10)

(ARTIFACTS / "shared-session-browser-results.json").write_text(json.dumps({"passed": len(checks), "checks": checks}, indent=2))
print(f"{len(checks)} shared session browser checks passed.")

