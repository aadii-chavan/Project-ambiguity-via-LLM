# Evaluation (Phase 7)

Model: `gemini-2.5-flash` · thinking budget 0 · strictness `balanced` · single run per row.
Harness: `backend/eval/` (`python -m eval.run_eval`), raw per-item outputs in `backend/eval/results_*.json`.

## Data
| Set | Items | Use |
|---|---|---|
| `dataset.jsonl` (dev) | 100 (50 ambiguous / 50 clear, 10 ambiguity types) | error analysis + prompt tuning |
| `heldout.jsonl` | 30 (15 / 15) | written *after* tuning, never used to tune |

Includes hard negatives (e.g. "fast-forward button", "secure-connection icon") and keyword-free ambiguities (referential, lexical, syntactic, undefined terms) that a keyword scan cannot see.

## Results — "is this requirement ambiguous?" (binary)
| Run | Method | Precision | Recall | F1 | Accuracy |
|---|---|---|---|---|---|
| Dev | Keyword baseline | 0.912 | 0.620 | 0.738 | 0.78 |
| Dev, prompt v1 | Gemini | 0.957 | 0.900 | 0.928 | 0.93 |
| Dev, prompt v2 (tuned) | Gemini | 0.942 | 0.980 | **0.961** | 0.96 |
| **Held-out**, prompt v2 | Keyword baseline | 0.857 | 0.400 | 0.545 | – |
| **Held-out**, prompt v2 | Gemini | 0.933 | 0.933 | **0.933** | 0.933 |

The keyword baseline is precise but misses ~40–60% of ambiguous requirements. Gemini closes that gap and stays on par with it on precision.

## Results — issue *type* (micro-averaged, per requirement)
| Run | Baseline F1 | Gemini F1 | Gemini P / R |
|---|---|---|---|
| Dev v1 | 0.673 | 0.708 | 0.769 / 0.656 |
| Dev v2 | 0.673 | 0.810 | 0.855 / 0.770 |
| Held-out v2 | 0.500 | 0.703 | 0.765 / 0.650 |

Dev v2 per type (F1): referential 1.00, lexical 1.00, open_ended 0.91, unbounded_quantifier 0.89, non_testable 0.89, vague_term 0.82, conflicting_condition 0.75, syntactic 0.75, undefined_term 0.67, missing_actor 0.63.

## Results — correction quality (LLM-as-judge, rewrites of flagged items)
| Run | n | Resolves ambiguity | Preserves intent | Invents facts | Rule-quality score |
|---|---|---|---|---|---|
| Dev v1 | 47 | 72% | 94% | 4.3% | 68 → 94 |
| Dev v2 | 52 | 73% | 96% | 0% | 70 → 92 |
| Held-out v2 | 15 | 67% | 93% | 0% | 67 → 93 |

## What the error analysis changed (v1 → v2)
| Observed in v1 | Fix in prompts |
|---|---|
| Missed lexical ambiguity ("refresh", "register"); labelled `bank` as undefined_term | Added guidance + example for lexical verbs |
| and/or precedence labelled `syntactic`; "SLA", "premium tier", "usual rules" labelled vague/missing_actor | Type-selection rules: boolean logic → conflicting_condition, undefined policy/tier/standard → undefined_term |
| Flagged "fast-forward" (compound name) | "Do not flag proper names / UI labels / compounds" |
| Rewrite invented "AES-256"; "etc." removed by silently narrowing the list; optional "might" made mandatory | Corrector rules: no invented technologies/numbers, preserve scope, preserve obligation level, don't resolve contradictions |

Invented-facts rate went 4.3% → 0% on dev and stayed 0% on held-out; held-out F1 (0.933) is close to dev (0.961), so the tuning mostly generalised.

## Known weaknesses (not fixed)
- **missing_actor** is the weakest type (F1 0.63): passive voice with an obvious actor ("The database shall be backed up…") is judged inconsistently — and my own labels are inconsistent there (A18 labelled ambiguous, C11 clear).
- **Rewrites that only name the actor** ("Orders shall be archived" → "The system shall archive orders") are marked "not resolving" by the judge; arguably the original was only mildly ambiguous.
- Some rewrites are weak: circular placeholder ("meet the criteria for 'old documents'"), a single string offering two readings (and/or case) instead of choosing a placeholder + question, and `drop` → `[TBD: action]`.
- Nested and/or and modifier-scope cases are still missed occasionally (A40, held-out HA06 "execute").

## Caveats — read before quoting these numbers
1. **Dataset authored by one person (an AI-assisted author) from the same taxonomy the prompts use** → likely optimistic vs. real SRS documents. Validate on a public corpus (e.g. PURE) or client documents before claiming general performance.
2. **Small samples.** Held-out n=30 → roughly ±0.1 on F1; differences between v1 and v2 on dev are 1–3 items.
3. **Dev numbers are tuned-on.** Use the held-out row as the honest estimate.
4. **The judge is the same model family** (self-preference bias) and is strict/noisy on "resolves ambiguity". Treat rewrite metrics as indicative; a human review of ~30 rewrites is recommended.
5. Single run, no repeat-variance measurement (Gemini output at temperature 0 can still vary).
6. Gold *types* overlap by nature (e.g. open_ended vs vague_term); binary detection is the more reliable metric.

## Reproduce
```bash
cd backend && conda activate req-ambiguity
python eval/build_dataset.py && python eval/build_heldout.py
python -m eval.run_eval --out results.json                                  # dev
python -m eval.run_eval --dataset heldout.jsonl --out results_heldout.json   # held-out
```
Results are cached in `eval/cache.json` (keyed by model + prompts + text), so re-runs are free until prompts or the model change. `--limit N` and `--no-correct` reduce cost.
