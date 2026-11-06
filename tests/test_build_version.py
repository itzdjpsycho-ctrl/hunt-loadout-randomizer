"""Build identities must change for HTML-only releases and notifier changes."""
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent

class BuildVersionTests(unittest.TestCase):
    def test_template_and_update_script_changes_get_new_build_urls(self):
        node=shutil.which('node')
        if not node:
            node=next((str(p) for p in (ROOT/'.tools').glob('node-*/node.exe')),None)
        self.assertIsNotNone(node,'Node.js is required for build checks')
        with tempfile.TemporaryDirectory(dir=ROOT/'artifacts',prefix='build-version-') as directory:
            target=Path(directory)
            for folder in ('app','data','scripts','assets/equipment','sources/items'):
                (target/folder).mkdir(parents=True,exist_ok=True)
            for source in (ROOT/'app').iterdir():
                if source.is_file() and source.name!='catalog.js':shutil.copy2(source,target/'app'/source.name)
            for name in ('loadout-rules.json','traits.json','custom-ammo.json'):
                shutil.copy2(ROOT/'data'/name,target/'data'/name)
            shutil.copy2(ROOT/'scripts/build-web.mjs',target/'scripts/build-web.mjs')
            catalog=json.loads((ROOT/'data/equipment.json').read_text(encoding='utf-8-sig'))
            knife=next(i for i in catalog['items'] if i['id']=='knife')
            catalog['items']=[knife]
            (target/'data/equipment.json').write_text(json.dumps(catalog))
            shutil.copy2(ROOT/knife['sourceSnapshot'],target/knife['sourceSnapshot'])
            shutil.copy2(ROOT/'assets/equipment/knife.png',target/'assets/equipment/knife.png')
            def build():
                subprocess.run([node,str(target/'scripts/build-web.mjs')],check=True,capture_output=True)
                version=json.loads((target/'site/assets/version.json').read_text())['version']
                page=(target/'site/index.html').read_text()
                self.assertIn('data-build-version="'+version+'"',page)
                self.assertIn('updates.js?v='+version,page)
                return version
            first=build()
            template=target/'app/index.template.html'
            template.write_text(template.read_text()+'\n<!-- HTML-only update -->\n')
            second=build();self.assertNotEqual(first,second)
            script=target/'app/updates.js'
            script.write_text(script.read_text()+'\n// Update notifier changed.\n')
            third=build();self.assertNotEqual(second,third)
            offline=(target/'Chaos-Loadout.html').read_text()
            self.assertIn('data-standalone',offline)
            self.assertNotIn('data-build-version=',offline)
