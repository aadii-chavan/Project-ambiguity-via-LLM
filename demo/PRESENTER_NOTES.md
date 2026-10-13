# Demo script — MediBook scope

**Files:** `medibook-srs.txt` (paste into Analyze) · `medibook-srs.docx` (upload instead, to show file import).
Both contain the same 19 requirements. The document is deliberately flawed: 13 ambiguous, 6 clear, covering all 10 ambiguity types.

## Project scope (for your slide)
**MediBook** is a web app for a multi-doctor clinic. Patients search for doctors, book / cancel appointments and pay online;
receptionists manage schedules; administrators manage accounts. The requirements below are a first draft written by the
team — the kind of text that usually causes rework when developers, testers and the client read it differently.

## Before you present (5 minutes)
1. Start the app, open **Settings** and confirm it says the model is *connected* (not "offline rules mode").
2. Run the analysis once beforehand so you know it works and how long it takes (~5-10 s).
3. Internet is required (Gemini API + the page font).
4. Start from an empty project if you want a clean dashboard: create a project called "MediBook".

## What the audience should see (Analyze → paste the text → "Analyze requirements")
Expected result: **19 requirements, 13 ambiguous, average quality ≈ 78 → 95.**

| # | Requirement (shortened) | Ambiguity found | Say this |
|---|---|---|---|
| R1 | "should respond **quickly**…" | non-testable + vague term | "Quickly" means 1 s to one person and 10 s to another. The tester can't write a pass/fail test. |
| R2 | "support **many** concurrent users" | unbounded quantifier | 10? 10,000? Capacity planning is impossible. |
| R3 | "reminders shall be sent **before the visit**" | missing actor + vague timing | Who sends it? A day before or 5 minutes before? |
| R4 | "payment methods **such as** cards, UPI, **etc.**" | open-ended list | "etc." is a scope trap: the client assumes wallets and net-banking are included. |
| R5 | "…before **she** confirms it" | referential (pronoun) | Receptionist or doctor? Two readings, two different workflows. |
| R6 | "editing of appointments **by patients with insurance**" | syntactic (scope) | Editing appointments that have insurance, or only insured patients may edit? |
| R7 | "minor **or** a senior **and** has a referral" | conflicting condition | Does the referral apply to both groups or only to seniors? Precedence is undefined. |
| R8 | "retained according to **the hospital policy**" | undefined term | Which policy? How many years? Nobody can implement it. |
| R9 | "interface shall be **intuitive** for elderly users" | vague term | Not measurable → rewrite asks for tasks, time limit and error count. |
| R10 | "**release** the slot…" | lexical (double meaning) | Release = make available again, or publish it? |
| R11 | "Duplicate bookings shall be **rejected**" | missing actor | Rejected by whom — the system, the receptionist? What is a "duplicate"? |
| R12 | "available **most of the time**" | vague quantifier | 90%? 99.9%? Contracts and SLAs need a number. |
| R13 | "notify patients by email, SMS, **and so on**" | open-ended | Same trap as R4. |
| R14–R19 | Account lock after 5 failed logins · email within 60 s · fee with 18% GST · cancel up to 2 h before · 2FA for admins · search < 2 s for 95% of requests | **none** | "It doesn't cry wolf — precise requirements pass untouched." Contrast **R19** with **R1**: same topic, one is testable. |

## Suggested walkthrough (≈ 6 min)
1. **Analyze**: paste the text; mention the options (strictness, rewrite style, glossary). Click Analyze.
2. **Requirements**: click **R5** — highlighted pronoun, explanation, the word-level diff of the rewrite.
3. Click **R1** — show `[TBD: response time]`: *the tool refuses to invent a number; it asks the stakeholder.* Show the clarifying question.
4. **Accept** R4, **Edit** R9 (type your own wording), **Reject** one. Point out the status badges.
5. Press **Ctrl/⌘ K**, search "slot" or "policy" → shows search across all analyses.
6. **Export → Word**: open the file — corrected requirements first, analysis details after.
7. **Dashboard**: KPIs, issue-type breakdown, severity bar, quality before/after.
8. Optional: **Projects** switcher — a second project keeps another document's results separate.

## Honest caveats (say them before someone asks)
- Rewrites are **suggestions**: R5's rewrite assumes "she" = the receptionist; a human must confirm. That is why there is Accept / Edit / Reject.
- R9 stays low after correction (≈ 68) on purpose — its rewrite still contains `[TBD]` placeholders because the missing facts must come from the client.
- Measured accuracy (30 unseen requirements): detection F1 0.93 vs 0.55 for a keyword baseline; see `docs/04-evaluation.md` for the caveats (small, author-written dataset).
- Results can vary slightly between runs because the LLM is not perfectly deterministic. If a line behaves differently live, that is the reason — the dry-run results above were produced on the day this file was written.
- If the internet or API key fails, the app falls back to a keyword-only mode (a yellow banner says so): fewer findings, no rewrites.
