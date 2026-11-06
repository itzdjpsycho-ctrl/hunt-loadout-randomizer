import re
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from server.main import app, create_app


class ServerTests(unittest.TestCase):
    def test_serves_built_page_assets_and_health(self):
        with TestClient(app) as client:
            page = client.get("/")
            self.assertEqual(page.status_code, 200)
            self.assertRegex(page.text, r'src="\./assets/app\.js\?v=[0-9a-f]{16}"')
            self.assertEqual(page.headers["cache-control"], "no-store")
            self.assertEqual(client.get("/index.html").text, page.text)
            for name in ("catalog.js", "engine.js", "expansion.js", "app.js", "updates.js", "styles.css"):
                asset = client.get("/assets/" + name)
                self.assertEqual(asset.status_code, 200)
                self.assertGreater(len(asset.content), 100)
            self.assertIn("mulliganKit", client.get("/assets/expansion.js").text)
            self.assertEqual(client.get("/api/health").json(), {"status": "ok"})

    def test_build_version_matches_html_and_bypasses_conditional_cache(self):
        with TestClient(app) as client:
            page = client.get('/')
            version = client.get('/assets/version.json')
            self.assertEqual(version.status_code, 200)
            self.assertEqual(version.headers['cache-control'], 'no-store')
            build = version.json()['version']
            self.assertRegex(build, r'^[a-f0-9]{16}$')
            self.assertIn('data-build-version="'+build+'"', page.text)
            versions = re.findall(r'assets/[^"?]+\?v=([a-f0-9]{16})', page.text)
            self.assertTrue(versions)
            self.assertTrue(all(v == build for v in versions))
            conditional = client.get('/assets/version.json', headers={'If-None-Match':version.headers['etag']})
            self.assertEqual(conditional.status_code, 200)
            self.assertEqual(conditional.json(), version.json())
            self.assertEqual(client.get('/index.html').headers['cache-control'], 'no-store')

    def test_does_not_expose_source_or_unknown_paths(self):
        with TestClient(app) as client:
            for path in ("/server/main.py", "/README.md", "/data/equipment.json", "/missing", "/assets/%2e%2e/server/main.py"):
                self.assertEqual(client.get(path).status_code, 404, path)

    def test_missing_build_fails_at_startup(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError, "npm run build"):
                with TestClient(create_app(Path(directory))):
                    pass


if __name__ == "__main__":
    unittest.main()

