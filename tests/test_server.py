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
            self.assertEqual(page.headers["cache-control"], "no-cache")
            self.assertEqual(client.get("/index.html").text, page.text)
            for name in ("catalog.js", "engine.js", "expansion.js", "app.js", "styles.css"):
                asset = client.get("/assets/" + name)
                self.assertEqual(asset.status_code, 200)
                self.assertGreater(len(asset.content), 100)
            self.assertIn("mulliganKit", client.get("/assets/expansion.js").text)
            self.assertEqual(client.get("/api/health").json(), {"status": "ok"})

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

