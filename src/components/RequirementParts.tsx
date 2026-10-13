import { diffWords } from 'diff'
import type { Issue, Severity } from '@/types'
import { ISSUE_META, SEVERITY_META } from '@/lib/utils'

export function HighlightedText({ text, issues }: { text: string; issues: Issue[] }) {
  const parts: React.ReactNode[] = []
  let at = 0
  ;[...issues].sort((a, b) => a.start - b.start).forEach((i, n) => {
    if (i.start < at) return
    parts.push(text.slice(at, i.start))
    const c = ISSUE_META[i.type].color
    parts.push(
      <mark key={n} title={`${ISSUE_META[i.type].label}: ${i.explanation}`} className="rounded-md px-1 py-0.5 font-semibold text-ink"
        style={{ background: `color-mix(in srgb, ${c} 20%, transparent)`, boxShadow: `inset 0 -2px 0 ${c}` }}>{text.slice(i.start, i.end)}</mark>,
    )
    at = i.end
  })
  parts.push(text.slice(at))
  return <p className="text-[17px] leading-8">{parts}</p>
}

export function DiffView({ before, after }: { before: string; after: string }) {
  return (
    <p className="text-[16px] leading-8">
      {diffWords(before, after).map((p, i) =>
        p.added ? <ins key={i} className="rounded bg-positive/15 px-0.5 font-medium text-positive no-underline">{p.value}</ins>
        : p.removed ? <del key={i} className="rounded bg-negative/10 px-0.5 text-negative/80">{p.value}</del>
        : <span key={i}>{p.value}</span>)}
    </p>
  )
}

export function IssueBadge({ type }: { type: Issue['type'] }) {
  const m = ISSUE_META[type]
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: `color-mix(in srgb, ${m.color} 14%, transparent)`, color: `color-mix(in srgb, ${m.color} 72%, var(--ink))` }}>{m.label}</span>
}

export function SeverityDot({ s }: { s: Severity | 'clean' }) {
  return <span className="size-2.5 shrink-0 rounded-full" style={{ background: s === 'clean' ? 'var(--positive)' : SEVERITY_META[s].color }} />
}
