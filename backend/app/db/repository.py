import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, text, update
from sqlalchemy.orm import Session

from app.db.models import ProjectRecord, SessionRecord
from app.schemas import AnalysisSession, Project, SearchHit

DEFAULT_PROJECT_NAME = "My first project"


def migrate(engine) -> None:
    """Tiny forward-only migration: add sessions.project_id to databases created before projects existed."""
    with engine.begin() as c:
        cols = [r[1] for r in c.execute(text("PRAGMA table_info(sessions)"))]
        if cols and "project_id" not in cols:
            c.execute(text("ALTER TABLE sessions ADD COLUMN project_id VARCHAR(32)"))
            c.execute(text("CREATE INDEX IF NOT EXISTS ix_sessions_project_id ON sessions (project_id)"))


# ---------- projects ----------
def _to_project(rec: ProjectRecord, count: int = 0) -> Project:
    return Project(id=rec.id, name=rec.name, created_at=rec.created_at, session_count=count)


def default_project(db: Session) -> ProjectRecord:
    """First (oldest) project; creates one if none exists, and adopts any orphaned sessions."""
    rec = db.scalars(select(ProjectRecord).order_by(ProjectRecord.created_at, ProjectRecord.id)).first()
    if not rec:
        rec = ProjectRecord(id=uuid.uuid4().hex[:12], name=DEFAULT_PROJECT_NAME)
        db.add(rec)
        db.commit()
    adopt_orphans(db, rec.id)
    return rec


def adopt_orphans(db: Session, project_id: str) -> None:
    orphans = db.scalars(select(SessionRecord).where(SessionRecord.project_id.is_(None))).all()
    for o in orphans:
        o.project_id = project_id
        o.payload = {**o.payload, "project_id": project_id}
    if orphans:
        db.commit()


def list_projects(db: Session) -> list[Project]:
    default_project(db)
    counts = dict(db.execute(select(SessionRecord.project_id, func.count()).group_by(SessionRecord.project_id)).all())
    rows = db.scalars(select(ProjectRecord).order_by(ProjectRecord.created_at, ProjectRecord.id)).all()
    return [_to_project(r, counts.get(r.id, 0)) for r in rows]


def get_project(db: Session, pid: str) -> ProjectRecord | None:
    return db.get(ProjectRecord, pid)


def name_taken(db: Session, name: str, exclude_id: str | None = None) -> bool:
    q = select(ProjectRecord).where(func.lower(ProjectRecord.name) == name.lower())
    return any(r.id != exclude_id for r in db.scalars(q))


def create_project(db: Session, name: str) -> Project:
    default_project(db)
    rec = ProjectRecord(id=uuid.uuid4().hex[:12], name=name, created_at=datetime.now(timezone.utc))
    db.add(rec)
    db.commit()
    return _to_project(rec)


def rename_project(db: Session, rec: ProjectRecord, name: str) -> Project:
    rec.name = name
    db.commit()
    return _to_project(rec, db.scalar(select(func.count()).where(SessionRecord.project_id == rec.id)) or 0)


def delete_project(db: Session, rec: ProjectRecord) -> None:
    db.execute(SessionRecord.__table__.delete().where(SessionRecord.project_id == rec.id))
    db.delete(rec)
    db.commit()


# ---------- sessions ----------
def save_session(db: Session, s: AnalysisSession) -> AnalysisSession:
    rec = db.get(SessionRecord, s.id)
    payload = s.model_dump(mode="json")
    if rec:
        rec.name, rec.payload, rec.project_id = s.name, payload, s.project_id or rec.project_id
    else:
        db.add(SessionRecord(id=s.id, name=s.name, project_id=s.project_id or None, created_at=s.created_at, payload=payload))
    db.commit()
    return s


def get_session(db: Session, sid: str) -> AnalysisSession | None:
    rec = db.get(SessionRecord, sid)
    return _load(rec) if rec else None


def _load(rec: SessionRecord) -> AnalysisSession:
    s = AnalysisSession.model_validate(rec.payload)
    s.project_id = rec.project_id or s.project_id
    return s


def list_sessions(db: Session, project_id: str | None = None) -> list[AnalysisSession]:
    default_project(db)  # also adopts sessions saved before projects existed
    q = select(SessionRecord).order_by(SessionRecord.created_at.desc())
    if project_id:
        q = q.where(SessionRecord.project_id == project_id)
    return [_load(r) for r in db.scalars(q).all()]


def delete_session(db: Session, sid: str) -> bool:
    rec = db.get(SessionRecord, sid)
    if not rec:
        return False
    db.delete(rec)
    db.commit()
    return True


# ---------- search ----------
def search(db: Session, q: str, project_id: str | None = None, limit: int = 30) -> list[SearchHit]:
    """Case-insensitive substring search over requirement text, rewrites and accepted text.
    Scans payloads in Python — fine for thousands of requirements; move to FTS5 if it grows."""
    needle = q.strip().lower()
    names = {p.id: p.name for p in list_projects(db)}
    hits: list[SearchHit] = []
    for s in list_sessions(db, project_id):
        for r in s.requirements:
            where = next((w for w, t in (("original", r.original), ("final", r.final_text), ("rewrite", r.suggested_rewrite))
                          if t and needle in t.lower()), None)
            if where:
                hits.append(SearchHit(session_id=s.id, session_name=s.name, project_id=s.project_id,
                                      project_name=names.get(s.project_id, ""), requirement_id=r.id,
                                      original=r.original, is_ambiguous=r.is_ambiguous, matched_in=where, created_at=s.created_at))
                if len(hits) >= limit:
                    return hits
    return hits
