from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import repository as repo
from app.db.session import get_db
from app.schemas import Project, ProjectCreate, SearchHit

router = APIRouter(prefix="/api", tags=["projects"])


@router.get("/projects", response_model=list[Project])
def list_projects(db: Session = Depends(get_db)):
    return repo.list_projects(db)


@router.post("/projects", response_model=Project, status_code=201)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    if repo.name_taken(db, body.name):
        raise HTTPException(409, "A project with that name already exists")
    return repo.create_project(db, body.name)


@router.patch("/projects/{pid}", response_model=Project)
def rename_project(pid: str, body: ProjectCreate, db: Session = Depends(get_db)):
    rec = repo.get_project(db, pid)
    if not rec:
        raise HTTPException(404, "Project not found")
    if repo.name_taken(db, body.name, exclude_id=pid):
        raise HTTPException(409, "A project with that name already exists")
    return repo.rename_project(db, rec, body.name)


@router.delete("/projects/{pid}", status_code=204)
def delete_project(pid: str, db: Session = Depends(get_db)):
    rec = repo.get_project(db, pid)
    if not rec:
        raise HTTPException(404, "Project not found")
    if len(repo.list_projects(db)) <= 1:
        raise HTTPException(409, "You can't delete your only project")
    repo.delete_project(db, rec)  # also deletes the project's analyses


@router.get("/search", response_model=list[SearchHit])
def search(q: str = Query(min_length=2, max_length=100), project_id: str | None = None, db: Session = Depends(get_db)):
    return repo.search(db, q, project_id)
