import { clsx, type ClassValue } from 'clsx'
import type { IssueType, Severity } from '@/types'

export const cn = (...v: ClassValue[]) => clsx(v)

export const ISSUE_META: Record<IssueType, { label: string; color: string }> = {
  vague_term: { label: 'Vague term', color: '#6c5ce7' },
  missing_actor: { label: 'Missing actor', color: '#e8a06a' },
  unbounded_quantifier: { label: 'Unbounded quantifier', color: '#16a34a' },
  referential: { label: 'Referential', color: '#0ea5e9' },
  lexical: { label: 'Lexical', color: '#ec4899' },
  syntactic: { label: 'Syntactic', color: '#8b5cf6' },
  conflicting_condition: { label: 'Conflicting condition', color: '#e5484d' },
  undefined_term: { label: 'Undefined term', color: '#14b8a6' },
  open_ended: { label: 'Open-ended', color: '#f5a524' },
  non_testable: { label: 'Non-testable', color: '#64748b' },
}

export const SEVERITY_META: Record<Severity, { label: string; color: string; weight: number }> = {
  high: { label: 'High', color: '#e5484d', weight: 35 },
  medium: { label: 'Medium', color: '#f5a524', weight: 20 },
  low: { label: 'Low', color: '#6c5ce7', weight: 8 },
}

export const scoreColor = (s: number) => (s >= 85 ? '#16a34a' : s >= 60 ? '#f5a524' : '#e5484d')

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
