"""Evaluate ambiguity detection + correction.

    python -m eval.run_eval [--limit N] [--no-correct] [--concurrency 4]

Compares (1) keyword-rule baseline and (2) the LLM pipeline on eval/dataset.jsonl.
LLM calls are cached in eval/cache.json (keyed by model + prompts + text), so re-runs are free
unless prompts/model change.
"""
import argparse
import asyncio
import hashlib
import json
import sys
from pathlib import Path

from app.config import settings
from app.prompts import templates as T
from app.services import corrector, detector
from app.services.llm_client import LLMError, get_llm
from app.services.rules import find_issues
from app.services.scorer import quality_after, quality_before
from eval.metrics import binary, per_type, types_micro

HERE = Path(__file__).parent
CACHE_FILE = HERE / "cache.json"
PROMPT_HASH = hashlib.sha256(json.dumps([T.DETECT_SYSTEM, T.CORRECT_SYSTEM, T.DETECT_TOOL, T.CORRECT_TOOL, T.STYLE, T.STRICTNESS], sort_keys=True).encode()).hexdigest()[:10]

JUDGE_SYSTEM = f"""You are a strict reviewer of software requirements rewrites.
Given an ORIGINAL requirement and its REWRITE, judge:
- resolves_ambiguity: the rewrite removes the ambiguity/vagueness of the original (a bracketed [TBD: ...] placeholder for a genuinely missing fact counts as an honest resolution).
- preserves_intent: the rewrite keeps the original meaning and scope.
- invents_facts: the rewrite adds concrete numbers, names or behaviour not implied by the original (placeholders are NOT inventions).
{T.SAFETY}"""
JUDGE_TOOL = {"name": "judge", "input_schema": {"type": "object", "properties": {
    "resolves_ambiguity": {"type": "boolean"}, "preserves_intent": {"type": "boolean"},
    "invents_facts": {"type": "boolean"}, "reason": {"type": "string"}},
    "required": ["resolves_ambiguity", "preserves_intent", "invents_facts", "reason"]}}


class Cache:
    def __init__(self):
        self.d = json.loads(CACHE_FILE.read_text()) if CACHE_FILE.exists() else {}

    def key(self, step: str, text: str, extra: str = "") -> str:
        return hashlib.sha256(f"{step}|{settings.llm_model}|{PROMPT_HASH}|{text}|{extra}".encode()).hexdigest()

    def save(self):
        CACHE_FILE.write_text(json.dumps(self.d))


async def run(args):
    rows = [json.loads(l) for l in (HERE / args.dataset).read_text().splitlines() if l.strip()]
    if args.limit:  # keep class balance when subsampling
        half = args.limit // 2
        rows = [r for r in rows if r["ambiguous"]][:half] + [r for r in rows if not r["ambiguous"]][:half]
    llm = get_llm()
    if llm is None:
        sys.exit("GEMINI_API_KEY is not set in backend/.env")
    cache, sem = Cache(), asyncio.Semaphore(args.concurrency)
    errors = 0

    async def cached(step, text, fn, extra=""):
        k = cache.key(step, text, extra)
        if k in cache.d:
            return cache.d[k]
        async with sem:
            v = await fn()
        cache.d[k] = v
        return v

    async def one(r):
        nonlocal errors
        text = r["text"]
        base = find_issues(text)
        out = {**r, "base_pred": bool(base), "base_types": sorted({i.type for i in base})}
        try:
            det = await cached("detect", text, lambda: _detect(llm, text, args.strictness), args.strictness)
            issues = detector.locate(text, det["issues"]) if det["is_ambiguous"] else []
            out.update(llm_pred=bool(issues), llm_types=sorted({i.type for i in issues}), llm_conf=det["confidence"],
                       llm_issues=[i.model_dump() for i in issues])
            if issues and not args.no_correct:
                cor = await cached("correct", text, lambda: _correct(llm, text, issues), json.dumps([i.span for i in issues]))
                out["rewrite"], out["questions"] = cor["rewrite"], cor["questions"]
                if cor["rewrite"]:
                    jd = await cached("judge", text, lambda: llm.generate_json(JUDGE_SYSTEM, f"<original>{text}</original>\n<rewrite>{cor['rewrite']}</rewrite>", JUDGE_TOOL), cor["rewrite"])
                    out["judge"] = jd
                    qb = quality_before(issues)
                    out["q_before"], out["q_after"] = qb, quality_after(cor["rewrite"], qb)
        except LLMError as e:
            errors += 1
            out["error"] = str(e)
        return out

    results = []
    tasks = [asyncio.create_task(one(r)) for r in rows]
    for n, t in enumerate(asyncio.as_completed(tasks), 1):
        results.append(await t)
        if n % 10 == 0:
            print(f"  {n}/{len(rows)} done", flush=True)
            cache.save()
    cache.save()
    results.sort(key=lambda r: r["id"])
    report(results, errors, args)


async def _detect(llm, text, strictness):
    from app.prompts.templates import DETECT_SYSTEM, DETECT_TOOL, detect_user
    d = await llm.generate_json(DETECT_SYSTEM, detect_user(text, [], [], [], [i.span for i in find_issues(text)], strictness), DETECT_TOOL)
    return {"is_ambiguous": bool(d.get("is_ambiguous", False)), "confidence": float(d.get("confidence", 0.5)), "issues": d.get("issues", [])}


async def _correct(llm, text, issues):
    rw, qs = await corrector.correct(llm, text, issues, "shall", [])
    return {"rewrite": rw, "questions": qs}


def report(results, errors, args):
    ok = [r for r in results if "error" not in r]
    gold = [r["ambiguous"] for r in ok]
    gtypes = [set(r["types"]) for r in ok]
    rep = {
        "model": settings.llm_model, "prompt_hash": PROMPT_HASH, "n": len(results), "llm_errors": errors,
        "baseline": {"binary": binary(gold, [r["base_pred"] for r in ok]), "types": types_micro(gtypes, [set(r["base_types"]) for r in ok])},
        "llm": {"binary": binary(gold, [r["llm_pred"] for r in ok]), "types": types_micro(gtypes, [set(r["llm_types"]) for r in ok]),
                "per_type": per_type(gtypes, [set(r["llm_types"]) for r in ok])},
    }
    judged = [r for r in ok if r.get("judge")]
    if judged:
        n = len(judged)
        rep["rewrite"] = {
            "n": n,
            "resolves_ambiguity": round(sum(r["judge"]["resolves_ambiguity"] for r in judged) / n, 3),
            "preserves_intent": round(sum(r["judge"]["preserves_intent"] for r in judged) / n, 3),
            "invents_facts": round(sum(r["judge"]["invents_facts"] for r in judged) / n, 3),
            "avg_quality_before": round(sum(r["q_before"] for r in judged) / n, 1),
            "avg_quality_after": round(sum(r["q_after"] for r in judged) / n, 1),
        }
    rep["false_positives"] = [{"id": r["id"], "text": r["text"], "flagged": r.get("llm_issues")} for r in ok if r["llm_pred"] and not r["ambiguous"]]
    rep["false_negatives"] = [{"id": r["id"], "text": r["text"], "gold": r["types"]} for r in ok if r["ambiguous"] and not r["llm_pred"]]
    rep["bad_rewrites"] = [{"id": r["id"], "text": r["text"], "rewrite": r["rewrite"], "judge": r["judge"]} for r in judged
                           if not (r["judge"]["resolves_ambiguity"] and r["judge"]["preserves_intent"]) or r["judge"]["invents_facts"]]
    (HERE / args.out).write_text(json.dumps({"summary": rep, "items": results}, indent=2, ensure_ascii=False))
    print(json.dumps({k: v for k, v in rep.items() if k not in ("false_positives", "false_negatives", "bad_rewrites")}, indent=2))
    print(f"\nFP={len(rep['false_positives'])} FN={len(rep['false_negatives'])} bad_rewrites={len(rep['bad_rewrites'])}  -> eval/{args.out}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--dataset", default="dataset.jsonl")
    ap.add_argument("--out", default="results.json")
    ap.add_argument("--no-correct", action="store_true")
    ap.add_argument("--concurrency", type=int, default=4)
    ap.add_argument("--strictness", default="balanced", choices=["lenient", "balanced", "strict"])
    asyncio.run(run(ap.parse_args()))
