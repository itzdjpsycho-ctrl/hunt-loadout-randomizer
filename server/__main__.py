"""Portable production launcher; hosting platforms can supply PORT."""

import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run("server.main:app", host=os.environ.get("HOST", "0.0.0.0"), port=int(os.environ.get("PORT", "8000")))
