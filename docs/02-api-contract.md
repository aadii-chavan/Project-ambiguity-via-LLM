# API Contract (v1)

Base: `/api`. All bodies JSON unless noted.

## POST /api/analyze
Request: `{ "text": string, "options": { "strictness": "lenient"|"balanced"|"strict", "style": "shall"|"user_story"|"free", "glossary": string[] } }`
Response: `AnalysisSession` (`engine`: `"llm"` | `"rules"` — `rules` means no API key / offline fallback)
Body also takes optional `project_id` (defaults to the oldest project; 404 if unknown).
Limits: 200 requirements, 200k chars, 20 requests/min/IP (429).

## POST /api/analyze/file   (multipart: `file` .txt/.md/.csv/.docx ≤2MB, optional `strictness`, `style`, `glossary` "a, b", `project_id`)
Response: `AnalysisSession`

## Projects
## GET    /api/projects          -> `Project[]` (oldest first, with `session_count`); a default "My first project" is created if none exists
## POST   /api/projects          body `{ "name": 1..60 chars }` -> 201 `Project` · 409 duplicate name (case-insensitive)
## PATCH  /api/projects/{id}     body `{ "name" }` -> `Project` · 404 · 409
## DELETE /api/projects/{id}     -> 204 and **deletes the project's analyses** · 409 if it is the only project

## GET /api/search?q=…&project_id=…   -> `SearchHit[]` (q: 2–100 chars, case-insensitive substring over original text, suggested rewrite and accepted text; max 30; `project_id` optional, default = all projects)

## GET /api/sessions?project_id=…   -> `AnalysisSession[]` (newest first; filter optional)
## GET /api/sessions/{id}       -> `AnalysisSession`
## PATCH /api/sessions/{id}/requirements/{rid}  body `{ "decision": "accepted"|"rejected"|"edited", "final_text"?: string }`
## DELETE /api/sessions/{id}   -> 204
## GET /api/sessions/{id}/export?format=json|csv|docx   -> file download (accepted/edited text is used as final text)

## Types
```ts
type IssueType = "vague_term"|"missing_actor"|"unbounded_quantifier"|"referential"|"lexical"
  |"syntactic"|"conflicting_condition"|"undefined_term"|"open_ended"|"non_testable";
type Severity = "low"|"medium"|"high";
type Decision = "pending"|"accepted"|"rejected"|"edited";

interface Issue { type: IssueType; severity: Severity; span: string; start: number; end: number; explanation: string; }

interface RequirementResult {
  id: string;                 // "R1"
  original: string;
  is_ambiguous: boolean;
  issues: Issue[];
  suggested_rewrite: string | null;
  clarifying_questions: string[];
  confidence: number;         // 0..1
  quality_before: number;     // 0..100
  quality_after: number;      // 0..100
  decision: Decision;
  final_text: string | null;
}

interface Project { id: string; name: string; created_at: string; session_count: number }
interface SearchHit { session_id: string; session_name: string; project_id: string; project_name: string;
  requirement_id: string; original: string; is_ambiguous: boolean; matched_in: "original"|"rewrite"|"final"; created_at: string }

interface AnalysisSession {
  id: string; project_id: string; created_at: string; name: string;
  summary: { total: number; ambiguous: number; ambiguity_rate: number;
             avg_quality_before: number; avg_quality_after: number;
             by_type: Record<IssueType, number>; by_severity: Record<Severity, number>; };
  requirements: RequirementResult[];
  engine: "llm" | "rules";
}
type SessionSummary = Pick<AnalysisSession,"id"|"created_at"|"name"> & { summary: AnalysisSession["summary"] };
```
`start`/`end` are character offsets into `original`.
Errors: `{ "error": { "code": string, "message": string } }` with 4xx/5xx.
