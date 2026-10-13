from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db import repository as repo
from app.db.session import get_db
from app.services.exporter import EXPORTERS, filename

router = APIRouter(prefix="/api/sessions", tags=["export"])


@router.get("/{sid}/export")
def export(sid: str, format: Literal["json", "csv", "docx"] = "json", db: Session = Depends(get_db)):
    s = repo.get_session(db, sid)
    if not s:
        raise HTTPException(404, "Session not found")
    render, media = EXPORTERS[format]
    return Response(render(s), media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="{filename(s, format)}"'})
