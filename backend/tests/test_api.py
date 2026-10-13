import json
from pathlib import Path

from app.db import repository as repo
from app.schemas import AnalysisSession

SEED = Path(__file__).resolve().parents[2] / "frontend" / "mock" / "session.json"


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_seed_matches_schema():
    AnalysisSession.model_validate(json.loads(SEED.read_text()))


def test_session_roundtrip_and_decision(client):
    s = AnalysisSession.model_validate(json.loads(SEED.read_text()))
    from app.main import app
    from app.db.session import get_db
    db = next(app.dependency_overrides[get_db]())
    repo.save_session(db, s)

    assert [x["id"] for x in client.get("/api/sessions").json()] == [s.id]
    r = client.patch(f"/api/sessions/{s.id}/requirements/R1", json={"decision": "accepted"})
    assert r.status_code == 200
    assert r.json()["requirements"][0]["final_text"] == s.requirements[0].suggested_rewrite
    assert client.get("/api/sessions/nope").status_code == 404
