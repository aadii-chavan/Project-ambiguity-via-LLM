from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import repository as repo
from app.db.session import get_db
from app.schemas import AnalysisSession, DecisionUpdate

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.get("", response_model=list[AnalysisSession])
def list_sessions(project_id: str | None = None, db: Session = Depends(get_db)):
    return repo.list_sessions(db, project_id)


@router.get("/{sid}", response_model=AnalysisSession)
def get_session(sid: str, db: Session = Depends(get_db)):
    s = repo.get_session(db, sid)
    if not s:
        raise HTTPException(404, "Session not found")
    return s


@router.patch("/{sid}/requirements/{rid}", response_model=AnalysisSession)
def decide(sid: str, rid: str, body: DecisionUpdate, db: Session = Depends(get_db)):
    s = repo.get_session(db, sid)
    if not s:
        raise HTTPException(404, "Session not found")
    req = next((r for r in s.requirements if r.id == rid), None)
    if not req:
        raise HTTPException(404, "Requirement not found")
    req.decision = body.decision
    req.final_text = (
        req.suggested_rewrite if body.decision == "accepted"
        else body.final_text if body.decision == "edited" else None
    )
    return repo.save_session(db, s)


@router.delete("/{sid}", status_code=204)
def delete_session(sid: str, db: Session = Depends(get_db)):
    if not repo.delete_session(db, sid):
        raise HTTPException(404, "Session not found")
