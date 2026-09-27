"""Serve only the Node-built frontend, never the repository directory."""

from contextlib import asynccontextmanager
from pathlib import Path
import os

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .sessions import Rooms, session_router

SITE = Path(__file__).resolve().parent.parent / "site"


def create_app(site: Path = SITE, database: Path | None = None) -> FastAPI:
    site = site.resolve()
    rooms = Rooms(database or Path(os.environ.get("SESSION_DB", SITE.parent / "runtime/sessions.sqlite3")), site / "session-catalog.json")

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if not (site / "index.html").is_file() or not (site / "assets").is_dir():
            raise RuntimeError("Frontend is missing. Run npm ci and npm run build first.")
        rooms.initialize()
        yield

    app = FastAPI(title="Hunt Loadout Randomizer", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.include_router(session_router(rooms))

    @app.get("/api/capabilities")
    async def capabilities():
        return {"sharedSessions": True}

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
