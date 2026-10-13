from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.ratelimit import analyze_limiter
from app.db import repository as repo
from app.db.session import get_db
from app.schemas import AnalysisSession, AnalyzeOptions, AnalyzeRequest
from app.services import parser, pipeline
from app.services.llm_client import LLMClient, get_llm

router = APIRouter(prefix="/api", tags=["analyze"])


def llm_dep() -> LLMClient | None:
    return get_llm()


def _project_id(db: Session, pid: str | None) -> str:
    if not pid:
        return repo.default_project(db).id
    if not repo.get_project(db, pid):
        raise HTTPException(404, "Project not found")
    return pid


async def _run(reqs: list[str], options: AnalyzeOptions, llm, db: Session, name: str | None, project_id: str | None = None) -> AnalysisSession:
    pid = _project_id(db, project_id)
    if not reqs:
        raise HTTPException(422, "No requirements found in the input")
    if len(reqs) > settings.max_requirements:
        raise HTTPException(413, f"Too many requirements (max {settings.max_requirements})")
    session = await pipeline.analyze(reqs, options, llm, name)
    session.project_id = pid
    return repo.save_session(db, session)


@router.post("/analyze", response_model=AnalysisSession, dependencies=[Depends(analyze_limiter)])
async def analyze(body: AnalyzeRequest, db: Session = Depends(get_db), llm=Depends(llm_dep)):
    return await _run(parser.split_requirements(body.text), body.options, llm, db, None, body.project_id)


@router.post("/analyze/file", response_model=AnalysisSession, dependencies=[Depends(analyze_limiter)])
async def analyze_file(file: UploadFile = File(...), strictness: str = Form("balanced"), style: str = Form("shall"),
                       glossary: str = Form(""), project_id: str | None = Form(None), db: Session = Depends(get_db), llm=Depends(llm_dep)):
    data = await file.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(413, "File too large")
    try:
        reqs = parser.parse_file(file.filename or "", data)
        options = AnalyzeOptions(strictness=strictness, style=style,
                                 glossary=[g.strip() for g in glossary.split(",") if g.strip()])
    except (parser.ParseError, ValueError) as e:
        raise HTTPException(422, str(e))
    return await _run(reqs, options, llm, db, (file.filename or "upload")[:100], project_id)
