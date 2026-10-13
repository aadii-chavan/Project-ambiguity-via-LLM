export type IssueType =
  | 'vague_term' | 'missing_actor' | 'unbounded_quantifier' | 'referential' | 'lexical'
  | 'syntactic' | 'conflicting_condition' | 'undefined_term' | 'open_ended' | 'non_testable'
export type Severity = 'low' | 'medium' | 'high'
export type Decision = 'pending' | 'accepted' | 'rejected' | 'edited'

export interface Issue {
  type: IssueType; severity: Severity; span: string; start: number; end: number; explanation: string
}
export interface RequirementResult {
  id: string; original: string; is_ambiguous: boolean; issues: Issue[]
  suggested_rewrite: string | null; clarifying_questions: string[]; confidence: number
  quality_before: number; quality_after: number; decision: Decision; final_text: string | null
}
export interface SessionStats {
  total: number; ambiguous: number; ambiguity_rate: number
  avg_quality_before: number; avg_quality_after: number
  by_type: Partial<Record<IssueType, number>>; by_severity: Record<Severity, number>
}
export interface Project { id: string; name: string; created_at: string; session_count: number }
export interface SearchHit {
  session_id: string; session_name: string; project_id: string; project_name: string; requirement_id: string
  original: string; is_ambiguous: boolean; matched_in: 'original' | 'rewrite' | 'final'; created_at: string
}
export interface AnalysisSession {
  id: string; project_id: string; created_at: string; name: string; summary: SessionStats; requirements: RequirementResult[]
  engine: 'llm' | 'rules'
}
export interface AnalyzeOptions {
  strictness: 'lenient' | 'balanced' | 'strict'; style: 'shall' | 'user_story' | 'free'; glossary: string[]
}
