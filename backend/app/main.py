from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import BASE_DIR, settings
from app.db import models  # noqa: F401  (register tables)
from app.db import repository as repo
from app.db.session import Base, SessionLocal, engine
from app.routers import analyze, export, history, projects
from app.static import mount_frontend


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    repo.migrate(engine)
    with SessionLocal() as db:
        repo.default_project(db)
    yield


app = FastAPI(title="ReqClear API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"],
)
app.include_router(analyze.router)
app.include_router(history.router)
app.include_router(projects.router)
app.include_router(export.router)


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": {"code": "internal_error", "message": "Unexpected server error"}})


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "llm_configured": settings.llm_enabled and bool(settings.gemini_api_key), "model": settings.llm_model}


# Must be registered last so API routes win. No-op unless `npm run build` has produced frontend/dist.
mount_frontend(app, BASE_DIR.parent / "frontend" / "dist")
