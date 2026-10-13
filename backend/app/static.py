"""Serve the built React app (frontend/dist) from FastAPI so production is a single process."""
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

_NO_CACHE = {"Cache-Control": "no-cache"}                       # always revalidate the entry page
_IMMUTABLE = {"Cache-Control": "public, max-age=31536000, immutable"}  # /assets/* filenames contain a content hash
_API_PREFIXES = ("api/", "docs", "redoc", "openapi.json", "health")


def mount_frontend(app: FastAPI, dist: Path) -> bool:
    index = dist / "index.html"
    if not index.is_file():
        return False
    root = dist.resolve()

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path == "api" or path.startswith(_API_PREFIXES):
            raise HTTPException(404, "Not found")
        target = (root / path).resolve()
        if path and target.is_file() and root in target.parents:  # no path traversal
            return FileResponse(target, headers=_IMMUTABLE if path.startswith("assets/") else _NO_CACHE)
        return FileResponse(index, headers=_NO_CACHE)  # client-side routes (/requirements/abc, /history, ...)

    return True
