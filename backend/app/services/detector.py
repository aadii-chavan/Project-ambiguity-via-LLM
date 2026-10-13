import re

from app.prompts.templates import DETECT_SYSTEM, DETECT_TOOL, detect_user
from app.schemas import Issue
from app.services.llm_client import LLMClient, LLMError
from app.services.rules import find_issues

_TYPES = set(DETECT_TOOL["input_schema"]["properties"]["issues"]["items"]["properties"]["type"]["enum"])
_SEV = {"low", "medium", "high"}


def _find(text: str, span: str) -> tuple[int, int] | None:
    """Prefer a whole-word match so span "he" lands on the pronoun, not inside "The"; then fall back to substring."""
    esc = re.escape(span)
    whole = (r"(?<!\w)" if span[0].isalnum() else "") + esc + (r"(?!\w)" if span[-1].isalnum() else "")
    for pat, flags in ((whole, 0), (whole, re.I), (esc, 0), (esc, re.I)):
        m = re.search(pat, text, flags)
        if m:
            return m.start(), m.end()
    return None


def locate(text: str, raw_issues: list[dict]) -> list[Issue]:
    """Attach character offsets server-side; drop hallucinated spans, bad enums and overlaps."""
    out: list[Issue] = []
    for r in raw_issues:
        span = str(r.get("span", ""))
        if r.get("type") not in _TYPES or r.get("severity") not in _SEV or not span:
            continue
        found = _find(text, span)
        if not found:
            continue
        k, end = found
        span = text[k:end]
        if any(k < o.end and end > o.start for o in out):
            continue
        out.append(Issue(type=r["type"], severity=r["severity"], span=span, start=k, end=end,
                         explanation=str(r.get("explanation", ""))[:300]))
    return sorted(out, key=lambda i: i.start)


async def detect(llm: LLMClient, text: str, before: list[str], after: list[str],
                 glossary: list[str], strictness: str) -> tuple[list[Issue], float]:
    hints = [i.span for i in find_issues(text)]
    data = await llm.generate_json(DETECT_SYSTEM, detect_user(text, before, after, glossary, hints, strictness), DETECT_TOOL)
    raw = data.get("issues", [])
    if not isinstance(raw, list) or not all(isinstance(r, dict) for r in raw):
        raise LLMError("Malformed model output")
    issues = locate(text, raw)
    try:
        conf = min(1.0, max(0.0, float(data.get("confidence", 0.5))))
    except (TypeError, ValueError):
        conf = 0.5
    return (issues if data.get("is_ambiguous", bool(issues)) is not False else []), conf
