"""Serve only the Node-built frontend, never the repository directory."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

SITE = Path(__file__).resolve().parent.parent / "site"


def create_app(site: Path = SITE) -> FastAPI:
    site = site.resolve()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if not (site / "index.html").is_file() or not (site / "assets").is_dir():
            raise RuntimeError("Frontend is missing. Run npm ci and npm run build first.")
        yield

    app = FastAPI(title="Hunt Loadout Randomizer", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    @app.get("/", include_in_schema=False)
    async def index():
        return FileResponse(site / "index.html", headers={"Cache-Control": "no-cache"})

    @app.get("/index.html", include_in_schema=False)
    async def index_file():
        return await index()

    app.mount("/assets", StaticFiles(directory=site / "assets", check_dir=False), name="assets")
    return app


app = create_app()
