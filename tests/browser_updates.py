"""Exercise release detection, safe refresh, cache busting and party reconnection."""
import json
import os
import shutil
import socket
import sys
import tempfile
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from playwright.sync_api import sync_playwright, expect
import uvicorn
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT))
from server.main import create_app

def main():
    with tempfile.TemporaryDirectory(dir=ROOT/'artifacts',prefix='website-updates-') as directory:
        temp=Path(directory);site=temp/'site';shutil.copytree(ROOT/'site',site)
        child=create_app(site,database=temp/'sessions.db')
        @asynccontextmanager
        async def lifespan(app):
            async with child.router.lifespan_context(child):yield
        app=FastAPI(lifespan=lifespan);app.mount('/randomizer',child)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        server=uvicorn.Server(uvicorn.Config(app,host='127.0.0.1',port=port,log_level='error'))
        thread=threading.Thread(target=server.run,daemon=True);thread.start()
        try:
            for _ in range(100):
                if server.started:break
                time.sleep(.05)
            assert server.started
            with sync_playwright() as pw:
                browser=pw.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE'))
                try:
                    page=browser.new_page(viewport={'width':1440,'height':1100})
                    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                    page.goto(f'http://127.0.0.1:{port}/randomizer/?keep=yes')
                    expect(page.locator('#session-create')).to_be_enabled()
                    expect(page.locator('#update-notice')).to_be_hidden()
                    original_version=page.evaluate('document.documentElement.dataset.buildVersion')
                    attempts=[];mode={'value':'offline'}
                    def manifest(route):
                        attempts.append(route.request.url)
                        if mode['value']=='offline':route.fulfill(status=503,body='unavailable')
                        elif mode['value']=='malformed':route.fulfill(status=200,content_type='application/json',body='{broken')
                        else:route.fulfill(status=200,json={'version':'invalid'})
                    page.route('**/assets/version.json*',manifest)
                    for value in ('offline','malformed','invalid'):
                        mode['value']=value;count=len(attempts)
                        page.evaluate("window.dispatchEvent(new Event('focus'))")
                        page.wait_for_function('true')
                        for _ in range(30):
                            if len(attempts)>count:break
                            page.wait_for_timeout(50)
                        assert len(attempts)>count
                        page.wait_for_timeout(50)
                        expect(page.locator('#update-notice')).to_be_hidden()
                    page.unroute('**/assets/version.json*')
                    page.locator('#session-name').fill('Updater');page.locator('#session-create').click()
                    expect(page.locator('#session-status')).to_contain_text('Connected')
                    credentials=page.evaluate("sessionStorage.getItem('dead-mans-hand.room.v1')")
                    room_hash=page.evaluate('location.hash')
                    # Publish a new fixture release without touching maintained source files.
                    next_version='b'*16 if original_version!='b'*16 else 'c'*16
                    original_html=(site/'index.html').read_text()
                    (site/'index.html').write_text(original_html.replace(original_version,next_version))
                    (site/'assets/version.json').write_text(json.dumps({'version':next_version}))
                    with (site/'assets/app.js').open('a') as asset:asset.write("\nwindow.RELEASE_MARKER='new-release';\n")
                    page.evaluate("window.dispatchEvent(new Event('focus'))")
                    expect(page.locator('#update-notice')).to_be_visible()
                    assert page.evaluate('document.documentElement.dataset.buildVersion')==original_version
                    assert page.evaluate('window.RELEASE_MARKER') is None
                    page.set_viewport_size({'width':390,'height':844})
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                    page.set_viewport_size({'width':1440,'height':1100})
                    # Click synchronously during the roll's initial asynchronous phase.
                    page.evaluate("() => {const roll=ChaosApp.roll();document.getElementById('update-refresh').click();return roll;}")
                    expect(page.locator('#update-message')).to_contain_text('Wait for the current action')
                    assert page.evaluate('document.documentElement.dataset.buildVersion')==original_version
                    expect(page.locator('[data-hunter-name="0"]')).to_be_enabled()
                    pending=[]
                    def hold_write(route):
                        if route.request.method=='PUT':pending.append(route)
                        else:route.continue_()
                    page.route('**/api/sessions/*',hold_write)
                    page.locator('[data-hunter-name="0"]').fill('Updater Saved')
                    page.locator('[data-hunter-name="0"]').press('Tab')
                    expect(page.locator('#session-status')).to_contain_text('Saving')
                    for _ in range(30):
                        if pending:break
                        page.wait_for_timeout(50)
                    assert len(pending)==1
                    page.locator('#update-refresh').click()
                    expect(page.locator('#update-message')).to_contain_text('Wait for the current action')
                    assert page.evaluate('document.documentElement.dataset.buildVersion')==original_version
                    pending[0].continue_()
                    expect(page.locator('#session-status')).to_contain_text('Connected')
                    page.unroute('**/api/sessions/*')
                    page.locator('#update-refresh').click()
                    page.wait_for_function('v=>document.documentElement.dataset.buildVersion===v',arg=next_version)
                    expect(page.locator('#session-status')).to_contain_text('Connected')
                    expect(page.locator('[data-hunter-name="0"]')).to_have_value('Updater Saved')
                    assert page.evaluate('window.RELEASE_MARKER')=='new-release'
                    assert page.evaluate('location.hash')==room_hash
                    assert page.evaluate("new URL(location.href).searchParams.get('keep')")=='yes'
                    assert page.evaluate("new URL(location.href).searchParams.get('_build')")==next_version
                    assert page.evaluate("sessionStorage.getItem('dead-mans-hand.room.v1')")==credentials
                    expect(page.locator('#update-notice')).to_be_hidden()
                    offline=browser.new_page();requests=[]
                    offline.on('request',lambda r:requests.append(r.url) if 'version.json' in r.url else None)
                    offline.goto((ROOT/'Chaos-Loadout.html').as_uri())
                    expect(offline.locator('#update-notice')).to_be_hidden()
                    assert not requests
                    assert not errors,errors
                    print('PASS matching/offline/malformed versions, subpath deployment, update banner without forced reload, mobile layout, active-roll and pending-save guards, new assets, preserved room credentials/hash/query, and standalone exclusion.')
                finally:browser.close()
        finally:
            server.should_exit=True;thread.join(timeout=10)
            assert not thread.is_alive(),'Test server failed to stop'

if __name__=='__main__':main()
