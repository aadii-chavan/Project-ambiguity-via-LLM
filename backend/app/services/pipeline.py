import asyncio
import hashlib
import logging
import uuid
from datetime import datetime, timezone

from app.schemas import AnalysisSession, AnalyzeOptions, RequirementResult
from app.services import corrector, detector, scorer
from app.services.llm_client import LLMClient, LLMError
from app.services.rules import find_issues

log = logging.getLogger(__name__)
CONCURRENCY = 5
CONTEXT_WINDOW = 2
_CACHE_MAX = 2000
_cache: dict[str, RequirementResult] = {}


def _key(text: str, o: AnalyzeOptions, ctx: str) -> str:
    return hashlib.sha256(f"{text}|{o.strictness}|{o.style}|{','.join(o.glossary)}|{ctx}".encode()).hexdigest()


def _rules_only(rid: str, text: str) -> RequirementResult:
    issues = find_issues(text)
    before = scorer.quality_before(issues)
    return RequirementResult(id=rid, original=text, is_ambiguous=bool(issues), issues=issues,
                             confidence=0.6 if issues else 0.7, quality_before=before, quality_after=before)


async def _llm_one(llm: LLMClient, rid: str, i: int, reqs: list[str], o: AnalyzeOptions, sem: asyncio.Semaphore) -> RequirementResult:
    text = reqs[i]
    before, after = reqs[max(0, i - CONTEXT_WINDOW):i], reqs[i + 1:i + 1 + CONTEXT_WINDOW]
    ck = _key(text, o, "|".join(before + after))
    if ck in _cache:
        return _cache[ck].model_copy(update={"id": rid}, deep=True)
    try:
        async with sem:
            issues, conf = await detector.detect(llm, text, before, after, o.glossary, o.strictness)
            rewrite, qs = (await corrector.correct(llm, text, issues, o.style, o.glossary)) if issues else (None, [])
    except LLMError:
        # One failed requirement must not sink the batch: fall back to rules for it.
        log.warning("LLM failed for %s, using rules fallback", rid)
        return _rules_only(rid, text)
    qb = scorer.quality_before(issues)
    res = RequirementResult(id=rid, original=text, is_ambiguous=bool(issues), issues=issues, suggested_rewrite=rewrite,
                            clarifying_questions=qs, confidence=round(conf, 2), quality_before=qb,
                            quality_after=scorer.quality_after(rewrite, qb))
    if len(_cache) >= _CACHE_MAX:
        _cache.pop(next(iter(_cache)))  # evict oldest
    _cache[ck] = res
    return res.model_copy(deep=True)


async def analyze(requirements: list[str], options: AnalyzeOptions, llm: LLMClient | None, name: str | None = None) -> AnalysisSession:
    ids = [f"R{n + 1}" for n in range(len(requirements))]
    if llm is None:
        results = [_rules_only(rid, t) for rid, t in zip(ids, requirements)]
        engine = "rules"
    else:
        sem = asyncio.Semaphore(CONCURRENCY)
        results = await asyncio.gather(*(_llm_one(llm, rid, i, requirements, options, sem) for i, rid in enumerate(ids)))
        engine = "llm"
    now = datetime.now(timezone.utc)
    return AnalysisSession(id=uuid.uuid4().hex[:12], created_at=now, engine=engine,
                           name=name or f"Analysis {now:%b %d, %H:%M}", summary=scorer.summarize(results), requirements=list(results))
