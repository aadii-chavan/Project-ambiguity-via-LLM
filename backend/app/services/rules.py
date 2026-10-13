"""Cheap rule-based pre-check. Used as (1) hints for the LLM, (2) offline fallback, (3) evaluation baseline."""
import re

from app.schemas import Issue, IssueType, Severity

_RULES: list[tuple[re.Pattern, IssueType, Severity, str]] = [
    (re.compile(r"\b(quick(?:ly)?|fast|slow|user-friendly|easy|easily|robust|efficient(?:ly)?|flexible|secure|reliable|modern|intuitive|seamless(?:ly)?|appropriate(?:ly)?|adequate(?:ly)?|reasonable|minimal|maximum|optimal|acceptable)\b", re.I), "vague_term", "high", "Subjective term with no measurable threshold."),
    (re.compile(r"\b(etc\.?|and so on|such as|and/or|as needed|if necessary|as appropriate|TBD|TBC)(?!\w)", re.I), "open_ended", "high", "Open-ended phrase; the full set is not enumerated."),
    (re.compile(r"\b(many|several|some|few|most|multiple|various|numerous|a lot of)\b", re.I), "unbounded_quantifier", "medium", "Quantity is not bounded or measurable."),
    (re.compile(r"\b(should|could|might|may|can)\b", re.I), "non_testable", "medium", "Not a binding obligation; requirements should use 'shall'."),
    (re.compile(r"\b(?:shall|will|must|should)\s+be\s+\w+ed\b", re.I), "missing_actor", "medium", "Passive voice; the responsible actor is not named."),
    (re.compile(r"\b(it|they|them|this|that)\b(?=\s+(?:shall|should|will|must|can|sends?|logs?))", re.I), "referential", "medium", "Pronoun may refer to more than one noun."),
]

WEIGHTS: dict[str, int] = {"high": 35, "medium": 20, "low": 8}


def find_issues(text: str) -> list[Issue]:
    issues: list[Issue] = []
    for rx, typ, sev, why in _RULES:
        for m in rx.finditer(text):
            s, e = m.start(), m.end()
            if any(s < i.end and e > i.start for i in issues):
                continue
            issues.append(Issue(type=typ, severity=sev, span=m.group(0), start=s, end=e, explanation=why))
    return sorted(issues, key=lambda i: i.start)


def penalty(issues: list[Issue]) -> int:
    return sum(WEIGHTS[i.severity] for i in issues)
