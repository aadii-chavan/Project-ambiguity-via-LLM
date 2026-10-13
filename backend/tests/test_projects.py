import json
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.db import repository as repo
from app.db.session import get_db
from app.main import app
from app.routers.analyze import llm_dep
from app.schemas import AnalysisSession

SEED = Path(__file__).resolve().parents[2] / "frontend" / "mock" / "session.json"


@pytest.fixture(autouse=True)
def rules_only():
    app.dependency_overrides[llm_dep] = lambda: None  # never call the real API
    yield
    app.dependency_overrides.pop(llm_dep, None)


def analyze(client, text_, project_id=None):
    r = client.post("/api/analyze", json={"text": text_, "project_id": project_id})
    assert r.status_code == 200, r.text
    return r.json()


def test_default_project_is_created_and_adopts_existing_sessions(client):
    db = next(app.dependency_overrides[get_db]())
    repo.save_session(db, AnalysisSession.model_validate(json.loads(SEED.read_text())))  # legacy: no project
    projects = client.get("/api/projects").json()
    assert len(projects) == 1 and projects[0]["name"] == "My first project" and projects[0]["session_count"] == 1
    assert client.get("/api/sessions").json()[0]["project_id"] == projects[0]["id"]


def test_create_rename_delete_and_validation(client):
    first = client.get("/api/projects").json()[0]
    p = client.post("/api/projects", json={"name": "  Payments  "})
    assert p.status_code == 201 and p.json()["name"] == "Payments"
    assert client.post("/api/projects", json={"name": "payments"}).status_code == 409        # case-insensitive dup
    assert client.post("/api/projects", json={"name": "   "}).status_code == 422
    assert client.post("/api/projects", json={"name": "x" * 61}).status_code == 422
    pid = p.json()["id"]
    assert client.patch(f"/api/projects/{pid}", json={"name": "Payments v2"}).json()["name"] == "Payments v2"
    assert client.patch(f"/api/projects/{pid}", json={"name": first["name"]}).status_code == 409
    assert client.patch(f"/api/projects/{pid}", json={"name": "Payments v2"}).status_code == 200  # same name ok
    assert client.patch("/api/projects/nope", json={"name": "z"}).status_code == 404
    assert client.delete(f"/api/projects/{pid}").status_code == 204
    assert client.delete("/api/projects/nope").status_code == 404
    assert client.delete(f"/api/projects/{first['id']}").status_code == 409                 # the only one left


def test_analyses_are_scoped_to_projects_and_deleted_with_them(client):
    a = client.get("/api/projects").json()[0]["id"]
    b = client.post("/api/projects", json={"name": "Mobile"}).json()["id"]
    sa = analyze(client, "The system should be fast.")                 # no project -> default
    sb = analyze(client, "The app must be intuitive.", b)
    assert sa["project_id"] == a and sb["project_id"] == b
    assert [s["id"] for s in client.get(f"/api/sessions?project_id={a}").json()] == [sa["id"]]
    assert [s["id"] for s in client.get(f"/api/sessions?project_id={b}").json()] == [sb["id"]]
    assert len(client.get("/api/sessions").json()) == 2
    counts = {p["id"]: p["session_count"] for p in client.get("/api/projects").json()}
    assert counts == {a: 1, b: 1}
    assert client.post("/api/analyze", json={"text": "The system should be fast.", "project_id": "nope"}).status_code == 404
    f = client.post("/api/analyze/file", files={"file": ("r.txt", b"The site shall be secure.")}, data={"project_id": b})
    assert f.json()["project_id"] == b
    client.delete(f"/api/projects/{b}")
    assert [s["id"] for s in client.get("/api/sessions").json()] == [sa["id"]]      # b's analyses gone, a's kept


def test_search(client):
    b = client.post("/api/projects", json={"name": "Mobile"}).json()["id"]
    s1 = analyze(client, "The system should respond quickly.\nUsers shall reset passwords by email.")
    s2 = analyze(client, "Passwords must be encrypted.", b)
    hits = client.get("/api/search?q=PASSWORD").json()                      # case-insensitive
    assert {(h["session_id"], h["requirement_id"]) for h in hits} == {(s1["id"], "R2"), (s2["id"], "R1")}
    assert {h["project_name"] for h in hits} == {"My first project", "Mobile"}
    assert [h["session_id"] for h in client.get(f"/api/search?q=password&project_id={b}").json()] == [s2["id"]]
    assert client.get("/api/search?q=zzzzzz").json() == []
    assert client.get("/api/search?q=a").status_code == 422                 # too short
    assert client.get("/api/search?q=" + "x" * 101).status_code == 422
    # accepted text is searchable too
    sid = s1["id"]
    client.patch(f"/api/sessions/{sid}/requirements/R1", json={"decision": "edited", "final_text": "The system shall answer within 2 seconds."})
    assert [h["matched_in"] for h in client.get("/api/search?q=within 2 seconds").json()] == ["final"]


def test_search_treats_input_as_literal_text(client):
    analyze(client, "The system shall store 100% of data.")
    assert len(client.get("/api/search?q=100%25 of").json()) == 1
    assert client.get("/api/search?q=%27%3B%20DROP%20TABLE%20sessions%3B--").json() == []


def test_migration_adds_project_column_to_legacy_database():
    eng = create_engine("sqlite://")
    with eng.begin() as c:
        c.execute(text("CREATE TABLE sessions (id VARCHAR(32) PRIMARY KEY, name VARCHAR(200), created_at DATETIME, payload JSON)"))
        s = AnalysisSession.model_validate(json.loads(SEED.read_text()))
        c.execute(text("INSERT INTO sessions VALUES (:i, :n, :c, :p)"),
                  {"i": s.id, "n": s.name, "c": s.created_at.isoformat(), "p": s.model_dump_json()})
    from app.db.models import ProjectRecord  # noqa: F401
    from app.db.session import Base
    repo.migrate(eng)
    repo.migrate(eng)                                    # idempotent
    Base.metadata.create_all(eng)
    db = sessionmaker(bind=eng, expire_on_commit=False)()
    got = repo.list_sessions(db)
    assert len(got) == 1 and got[0].project_id and got[0].project_id == repo.default_project(db).id
