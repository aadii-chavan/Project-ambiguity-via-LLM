from collections import Counter

from app.schemas import Issue, RequirementResult, SessionStats
from app.services.rules import WEIGHTS, find_issues, penalty

TBD = "[TBD"


def quality_before(issues: list[Issue]) -> int:
    return max(0, 100 - penalty(issues))


def quality_after(rewrite: str | None, before: int) -> int:
    """Re-check the rewrite with the rule engine; unresolved [TBD] placeholders cost a little."""
    if not rewrite:
        return before
    left = penalty(find_issues(rewrite.replace("[TBD", "")))
    tbd = rewrite.count(TBD) * WEIGHTS["low"]
    return max(before, max(0, 100 - left - tbd))


def summarize(reqs: list[RequirementResult]) -> SessionStats:
    by_type: Counter[str] = Counter()
    by_sev = {"high": 0, "medium": 0, "low": 0}
    for r in reqs:
        for i in r.issues:
            by_type[i.type] += 1
            by_sev[i.severity] += 1
    n = len(reqs)
    amb = sum(r.is_ambiguous for r in reqs)
    avg = lambda k: round(sum(getattr(r, k) for r in reqs) / n, 1) if n else 0.0  # noqa: E731
    return SessionStats(
        total=n, ambiguous=amb, ambiguity_rate=round(amb / n, 3) if n else 0.0,
        avg_quality_before=avg("quality_before"), avg_quality_after=avg("quality_after"),
        by_type=dict(by_type), by_severity=by_sev,
    )
