import io
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from docx import Document

from app.config import settings
from app.db import repository as repo
from app.db.session import get_db
from app.main import app
from app.ratelimit import RateLimiter, analyze_limiter
from app.schemas import AnalysisSession
from app.services import llm_client
from app.services.exporter import to_csv

SEED = Path(__file__).resolve().parents[2] / "frontend" / "mock" / "session.json"


@pytest.fixture()
def sid(client):
    s = AnalysisSession.model_validate(json.loads(SEED.read_text()))
    s.requirements[1].original = "=HYPERLINK(\"http://evil\")"  # formula injection attempt
    repo.save_session(next(app.dependency_overrides[get_db]()), s)
    client.patch(f"/api/sessions/{s.id}/requirements/R1", json={"decision": "accepted"})
    return s.id


def test_export_json_csv_docx(client, sid):
    j = client.get(f"/api/sessions/{sid}/export?format=json")
    assert j.status_code == 200 and json.loads(j.content)["id"] == sid
    assert "attachment" in j.headers["content-disposition"]

    c = client.get(f"/api/sessions/{sid}/export?format=csv")
    text = c.content.decode("utf-8-sig")
    assert "within 2 seconds" in text            # accepted rewrite is the final text
    assert "'=HYPERLINK" in text and ",=HYPERLINK" not in text

    d = client.get(f"/api/sessions/{sid}/export?format=docx")
    doc = Document(io.BytesIO(d.content))
    body = "\n".join(p.text for p in doc.paragraphs)
    assert "Corrected requirements" in body and "within 2 seconds" in body


def test_export_errors(client, sid):
    assert client.get("/api/sessions/nope/export").status_code == 404
    assert client.get(f"/api/sessions/{sid}/export?format=pdf").status_code == 422


def test_delete(client, sid):
    assert client.delete(f"/api/sessions/{sid}").status_code == 204
    assert client.delete(f"/api/sessions/{sid}").status_code == 404


def test_csv_empty_session_ok():
    s = AnalysisSession.model_validate(json.loads(SEED.read_text()))
    s.requirements = []
    assert to_csv(s).decode("utf-8-sig").startswith("id,original")


def test_rate_limiter():
    rl = RateLimiter(limit=2)
    req = SimpleNamespace(client=SimpleNamespace(host="1.2.3.4"))
    rl(req); rl(req)
    with pytest.raises(Exception) as e:
        rl(req)
    assert getattr(e.value, "status_code", None) == 429


def test_analyze_endpoint_is_rate_limited(client):
    from app.routers.analyze import llm_dep
    app.dependency_overrides[llm_dep] = lambda: None  # never hit the real API in tests
    analyze_limiter.hits.clear()
    codes = [client.post("/api/analyze", json={"text": "The system shall be fast."}).status_code for _ in range(21)]
    analyze_limiter.hits.clear()
    app.dependency_overrides.pop(llm_dep)
    assert codes[0] == 200 and codes[-1] == 429


async def test_gemini_client_builds_request(monkeypatch):
    seen = {}

    class FakeModels:
        async def generate_content(self, model, contents, config):
            seen.update(model=model, contents=contents, cfg=config)
            return SimpleNamespace(text='{"is_ambiguous": false, "confidence": 0.9, "issues": []}')

    c = llm_client.GeminiClient("fake-key", settings.llm_model)
    c._c = SimpleNamespace(aio=SimpleNamespace(models=FakeModels()))
    out = await c.generate_json("sys", "usr", {"name": "x", "input_schema": {"type": "object"}})
    assert out["is_ambiguous"] is False
    assert seen["model"] == settings.llm_model and seen["cfg"].response_mime_type == "application/json"

    class Bad(FakeModels):
        async def generate_content(self, **kw):
            return SimpleNamespace(text="not json")

    c._c = SimpleNamespace(aio=SimpleNamespace(models=Bad()))
    with pytest.raises(llm_client.LLMError):
        await c.generate_json("s", "u", {"name": "x", "input_schema": {}})
