"""Verify hosted reels survive save acknowledgements and animate peer rolls."""
import os
from pathlib import Path
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

with tempfile.TemporaryDirectory(dir=ARTIFACTS) as directory:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    url = f"http://127.0.0.1:{port}/"
    env = {**os.environ, "SESSION_DB": str(Path(directory) / "rooms.db")}
    with open(ARTIFACTS / "party-reveal-server.log", "w") as log:
        server = subprocess.Popen([sys.executable, "-m", "uvicorn", "server.main:app", "--host", "127.0.0.1", "--port", str(port)], cwd=ROOT, env=env, stdout=log, stderr=log)
        try:
            for _ in range(80):
                try:
                    with urlopen(url + "api/health", timeout=1):
                        break
                except OSError:
                    time.sleep(.1)
            else:
                raise RuntimeError("Test server did not start")
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True, executable_path=os.environ.get("BROWSER_EXECUTABLE"))
                host = browser.new_page()
                guest = browser.new_page()
                errors = []
                for page in (host, guest):
                    page.on("pageerror", lambda error: errors.append(str(error)))
                host.goto(url)
                host.locator("#squad-options-open").click()
                host.locator("#reveal-animation").check()
                host.locator("#single-rerolls").check()
                host.locator('[data-close="squad-options-dialog"]').first.click()
                host.locator("#session-name").fill("Host")
                host.locator("#session-create").click()
                expect(host.locator("#session-status")).to_contain_text("Connected")
                code = host.locator("#session-room-code").inner_text().split()[-1]
                guest.goto(url + "#room=" + code)
                guest.locator("#party-invite-name").fill("Guest")
                guest.locator("#party-invite-join").click()
                expect(guest.locator("#session-status")).to_contain_text("Connected")
                expect(host.locator("#session-members li")).to_have_count(2)
                host.locator("#roll").click()
                expect(host.locator("#session-status")).to_contain_text("Connected")
                host.wait_for_timeout(350)
                expect(host.locator(".slot-reel").first).to_be_visible()
                expect(guest.locator(".slot-reel").first).to_be_visible()
                expect(host.locator("#skip-reveal")).to_be_hidden(timeout=7000)
                expect(guest.locator("#skip-reveal")).to_be_hidden(timeout=7000)
                before=guest.evaluate("ChaosApp.getSharedState()")
                expect(guest.locator('[data-dont-own="0"][data-hunter="0"]')).to_be_disabled()
                guest.locator('[data-dont-own="0"][data-hunter="1"]').click()
                expect(guest.locator("#session-status")).to_contain_text("Connected")
                expect(host.locator(".slot-reel").first).to_be_visible()
                after=guest.evaluate("ChaosApp.getSharedState()")
                assert after['builds'][1]['slots'][0]!=before['builds'][1]['slots'][0]
                assert after['builds'][1]['slots'][1:]==before['builds'][1]['slots'][1:]
                assert after['builds'][0]==before['builds'][0]
                assert after['builds'][1]['loadoutMulligans']==before['builds'][1]['loadoutMulligans']
                expect(host.locator("#skip-reveal")).to_be_hidden(timeout=7000)
                expect(guest.locator("#skip-reveal")).to_be_hidden(timeout=7000)
                guest.locator('[data-mulligan="3"][data-hunter="1"]').click()
                expect(guest.locator("#session-status")).to_contain_text("Connected")
                guest.wait_for_timeout(350)
                expect(guest.locator(".hunter-loadout").nth(1).locator(".slot-reel").first).to_be_visible()
                expect(host.locator(".hunter-loadout").nth(1).locator(".slot-reel").first).to_be_visible()
                expect(host.locator(".hunter-loadout").nth(0).locator(".slot-reel")).to_have_count(0)
                expect(guest.locator("#skip-reveal")).to_be_hidden(timeout=7000)
                expect(host.locator("#skip-reveal")).to_be_hidden(timeout=7000)
                guest.locator('[data-loadout-mulligan="1"]').click()
                expect(guest.locator("#session-status")).to_contain_text("Connected")
                guest.wait_for_timeout(350)
                expect(guest.locator(".slot-reel").first).to_be_visible()
                expect(host.locator(".slot-reel").first).to_be_visible()
                host.locator("#skip-reveal").click()
                guest.locator("#skip-reveal").click()
                expect(host.locator(".slot-reel")).to_have_count(0)
                expect(guest.locator(".slot-reel")).to_have_count(0)
                assert host.evaluate("ChaosApp.getSharedState()") == guest.evaluate("ChaosApp.getSharedState()")
                assert not errors, errors
                browser.close()
                print("PASS Hosted deals, item/loadout mulligans, acknowledgement survival, peer animation and Skip")
        finally:
            server.terminate()
            server.wait(timeout=10)
