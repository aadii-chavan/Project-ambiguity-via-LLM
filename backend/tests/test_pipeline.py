import io

import pytest
from docx import Document

from app.main import app
from app.routers.analyze import llm_dep
from app.schemas import AnalyzeOptions
from app.services import parser, pipeline, scorer
from app.services.detector import locate
from app.services.llm_client import LLMError
from app.services.rules import find_issues


class FakeLLM:
    def __init__(self, fail_on: str | None = None):
        self.calls, self.fail_on = [], fail_on

    async def generate_json(self, system, user, tool):
        self.calls.append(tool["name"])
        if self.fail_on and self.fail_on in user:
            raise LLMError("boom")
        if tool["name"] == "report_ambiguity":
            if "quickly" in user:
                return {"is_ambiguous": True, "confidence": 0.9, "issues": [
                    {"type": "vague_term", "severity": "high", "span": "quickly", "explanation": "no threshold"},
                    {"type": "vague_term", "severity": "high", "span": "NOT IN TEXT", "explanation": "hallucinated"}]}
            return {"is_ambiguous": False, "confidence": 0.95, "issues": []}
        return {"rewrite": "The system shall respond within 2 seconds.", "clarifying_questions": ["What is the limit?"]}


@pytest.fixture(autouse=True)
def _clear_cache():
    pipeline._cache.clear()


def test_split_requirements_strips_prefixes():
    t = "1. The system shall A.\n- The system shall B.\nREQ-3: The system shall C.\n\nx\n"
    assert parser.split_requirements(t) == ["The system shall A.", "The system shall B.", "The system shall C."]


def test_parse_csv_and_docx():
    csv_bytes = b"id,Requirement\n1,The system shall X\n2,The system shall Y\n"
    assert parser.parse_file("a.csv", csv_bytes) == ["The system shall X", "The system shall Y"]
    d = Document(); d.add_paragraph("The system shall Z."); buf = io.BytesIO(); d.save(buf)
    assert parser.parse_file("a.docx", buf.getvalue()) == ["The system shall Z."]
    with pytest.raises(parser.ParseError):
        parser.parse_file("a.exe", b"x")


def test_rules_and_scoring():
    issues = find_issues("The system should respond quickly.")
    assert {i.type for i in issues} == {"non_testable", "vague_term"}
    assert scorer.quality_before(issues) == 100 - 20 - 35
    assert scorer.quality_after("The system shall respond within 2 seconds.", 45) == 100
    assert scorer.quality_after("The system shall respond within [TBD: time].", 45) == 92


def test_locate_drops_hallucinated_and_fixes_case():
    out = locate("The system responds Quickly.", [
        {"type": "vague_term", "severity": "high", "span": "quickly", "explanation": "x"},
        {"type": "vague_term", "severity": "high", "span": "nope", "explanation": "x"},
        {"type": "bogus", "severity": "high", "span": "system", "explanation": "x"}])
    assert len(out) == 1 and out[0].span == "Quickly" and (out[0].start, out[0].end) == (20, 27)


async def test_pipeline_llm_path_and_cache():
    llm = FakeLLM()
    reqs = ["The system should respond quickly.", "The system shall log every login."]
    s = await pipeline.analyze(reqs, AnalyzeOptions(), llm)
    assert s.engine == "llm" and s.summary.ambiguous == 1
    r1, r2 = s.requirements
    assert [i.span for i in r1.issues] == ["quickly"] and r1.suggested_rewrite and r1.quality_after > r1.quality_before
    assert not r2.is_ambiguous and r2.quality_before == 100
    n = len(llm.calls)
    await pipeline.analyze(reqs, AnalyzeOptions(), llm)
    assert len(llm.calls) == n  # served from cache


async def test_pipeline_one_failure_falls_back_to_rules():
    s = await pipeline.analyze(["The system shall be fast.", "The system shall do Y."], AnalyzeOptions(), FakeLLM(fail_on="fast"))
    assert s.requirements[0].is_ambiguous and s.requirements[0].suggested_rewrite is None
    assert not s.requirements[1].is_ambiguous


async def test_pipeline_without_llm_uses_rules():
    s = await pipeline.analyze(["It should be easy."], AnalyzeOptions(), None)
    assert s.engine == "rules" and s.requirements[0].is_ambiguous


def test_endpoints(client):
    app.dependency_overrides[llm_dep] = lambda: FakeLLM()
    r = client.post("/api/analyze", json={"text": "1. The system should respond quickly.\n2. The system shall log logins."})
    assert r.status_code == 200
    sid = r.json()["id"]
    assert client.get(f"/api/sessions/{sid}").json()["summary"]["total"] == 2

    f = client.post("/api/analyze/file", files={"file": ("r.txt", b"The system should respond quickly.")}, data={"glossary": "SLA, PII"})
    assert f.status_code == 200 and f.json()["name"] == "r.txt"
    assert client.post("/api/analyze/file", files={"file": ("r.exe", b"x")}).status_code == 422
    assert client.post("/api/analyze", json={"text": "  \n "}).status_code == 422
    assert client.post("/api/analyze", json={"text": "x" * 20, "options": {"strictness": "wild"}}).status_code == 422
    app.dependency_overrides.pop(llm_dep)


def test_locate_prefers_whole_words():
    t = "The admin shall review the report before he sends it to the board with care."
    out = locate(t, [{"type": "referential", "severity": "medium", "span": "he", "explanation": "x"},
                     {"type": "referential", "severity": "medium", "span": "it", "explanation": "x"}])
    assert [(i.span, t[i.start:i.end]) for i in out] == [("he", "he"), ("it", "it")]
    assert t[out[0].start - 7:out[0].start] == "before "          # the pronoun, not the "he" inside "The"
    assert t[out[1].start - 6:out[1].start] == "sends "           # not the "it" inside "with"


def test_locate_falls_back_to_substring_and_case():
    out = locate("Support QUICKLY loading.", [{"type": "vague_term", "severity": "high", "span": "quick", "explanation": "x"}])
    assert out[0].span == "QUICK"
