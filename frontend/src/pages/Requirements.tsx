import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useProject } from '@/lib/project'
import EngineBanner from '@/components/EngineBanner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Download, FileText, HelpCircle, Pencil, Search, Table, X } from 'lucide-react'
import { api, exportUrl } from '@/api/client'
import { Button, Card, EmptyState, IconButton, PageHeader, ScoreRing, Skeleton } from '@/components/ui'
import { DiffView, HighlightedText, IssueBadge, SeverityDot } from '@/components/RequirementParts'
import { cn, SEVERITY_META } from '@/lib/utils'
import type { AnalysisSession, RequirementResult, Severity } from '@/types'

const topSeverity = (r: RequirementResult): Severity | 'clean' =>
  r.issues.length ? (['high', 'medium', 'low'] as const).find((s) => r.issues.some((i) => i.severity === s))! : 'clean'

export default function Requirements() {
  const { id } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const { current, setCurrent } = useProject()
  const [params] = useSearchParams()
  const sessions = useQuery({ queryKey: ['sessions', current?.id], queryFn: () => api.listSessions(current!.id), enabled: !!current })
  const sid = id ?? sessions.data?.[0]?.id
  const { data: session } = useQuery({ queryKey: ['session', sid], queryFn: () => api.getSession(sid!), enabled: !!sid })
  const [sel, setSel] = useState<string | undefined>(params.get('req') ?? undefined)
  const wanted = params.get('req')
  useEffect(() => { setSel(wanted ?? undefined) }, [wanted, id])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'ambiguous' | 'clean' | 'pending'>('all')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const list = useMemo(() => (session?.requirements ?? []).filter((r) =>
    (filter === 'all' || (filter === 'ambiguous' && r.is_ambiguous) || (filter === 'clean' && !r.is_ambiguous) || (filter === 'pending' && r.is_ambiguous && r.decision === 'pending')) &&
    r.original.toLowerCase().includes(q.toLowerCase())), [session, q, filter])
  const cur = session?.requirements.find((r) => r.id === sel) ?? list[0]
  useEffect(() => { setEditing(false) }, [cur?.id])
  // Arriving at an analysis from another project (search hit / link): follow it into its project, once.
  // If the user then switches project while viewing it, leave the analysis instead of bouncing them back.
  const followed = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!session || !current) return
    if (session.project_id === current.id) { followed.current = session.id; return }
    if (followed.current !== session.id) { followed.current = session.id; setCurrent(session.project_id) }
    else nav('/requirements', { replace: true })
  }, [session, current, setCurrent, nav])

  const decide = useMutation({
    mutationFn: (v: { rid: string; d: 'accepted' | 'rejected' | 'edited'; text?: string }) => api.decide(session!.id, v.rid, v.d, v.text),
    onSuccess: (s: AnalysisSession) => { qc.setQueryData(['session', s.id], s); qc.invalidateQueries({ queryKey: ['sessions'] }) },
  })

  if (sessions.isError) return <><PageHeader title="Requirements" /><EmptyState title="Can't load data" body={sessions.error.message} /></>
  const failed = decide.isError ? decide.error.message : null
  if (!current || sessions.isLoading || (sid && !session)) return <div className="grid gap-4 p-8 lg:grid-cols-[380px_1fr]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>
  if (!sid || !session || !session.requirements.length)
    return <><PageHeader title="Requirements" /><EmptyState title={`No analyses in ${current.name} yet`} body="Analyze a document to review ambiguous requirements here." action={<Link to="/analyze"><Button>Go to Analyze</Button></Link>} /></>

  const s = session.summary
  const acceptAll = () => session.requirements.filter((r) => r.is_ambiguous && r.decision === 'pending' && r.confidence >= 0.9).forEach((r) => decide.mutate({ rid: r.id, d: 'accepted' }))

  return (
    <>
      <PageHeader title="Requirements" subtitle={`${session.name} · ${s.ambiguous} of ${s.total} ambiguous`}
        right={<>
          <select value={session.id} onChange={(e) => nav(`/requirements/${e.target.value}`)} className="h-10 max-w-56 cursor-pointer rounded-xl border bg-card px-3 text-sm font-medium outline-none">
            {sessions.data?.filter((x) => x.requirements.length).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <Button variant="ghost" onClick={acceptAll}><Check size={16} />Accept all high-confidence</Button>
          <ExportMenu id={session.id} />
        </>} />

      <EngineBanner engine={session.engine} />
      <div className="mx-6 mt-6 grid gap-6 sm:mx-8 lg:grid-cols-[380px_1fr]">
        <Card className="flex max-h-[720px] flex-col overflow-hidden">
          <div className="space-y-3 border-b p-4">
            <div className="relative"><Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search requirements" className="h-10 w-full rounded-xl border bg-card pl-9 text-sm outline-none focus:ring-2 focus:ring-primary/30" /></div>
            <div className="flex gap-1.5">
              {(['all', 'ambiguous', 'pending', 'clean'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={cn('cursor-pointer rounded-full px-3 py-1 text-xs font-semibold capitalize transition', filter === f ? 'bg-tint text-primary' : 'text-muted hover:bg-hover')}>{f}</button>
              ))}
            </div>
          </div>
          <div className="scroll-thin flex-1 overflow-y-auto p-2">
            {list.length === 0 && <p className="p-6 text-center text-sm text-muted">No matches</p>}
            {list.map((r) => (
              <button key={r.id} onClick={() => setSel(r.id)} className={cn('flex w-full cursor-pointer items-center gap-3 rounded-2xl p-3 text-left transition', cur?.id === r.id ? 'bg-tint' : 'hover:bg-hover')}>
                <ScoreRing score={r.decision === 'accepted' || r.decision === 'edited' ? r.quality_after : r.quality_before} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted"><SeverityDot s={topSeverity(r)} />{r.id}
                    {r.decision !== 'pending' && <span className="rounded-full bg-positive/15 px-2 py-0.5 text-positive capitalize">{r.decision}</span>}</div>
                  <div className="mt-0.5 line-clamp-2 text-sm font-medium">{r.original}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {cur && (
          <Card key={cur.id} className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3"><h2 className="text-xl font-bold">{cur.id}</h2>
                {cur.is_ambiguous ? <span className="rounded-full bg-negative/10 px-3 py-1 text-xs font-bold text-negative">Ambiguous</span> : <span className="rounded-full bg-positive/10 px-3 py-1 text-xs font-bold text-positive">Clear</span>}</div>
              <div className="text-sm text-muted">Confidence <b className="text-ink">{Math.round(cur.confidence * 100)}%</b> · Quality <b className="text-ink">{cur.quality_before}</b> → <b className="text-positive">{cur.quality_after}</b></div>
            </div>

            <Section title="Original"><HighlightedText text={cur.original} issues={cur.issues} /></Section>

            {cur.issues.length > 0 && (
              <Section title={`Issues (${cur.issues.length})`}>
                <div className="space-y-2">
                  {cur.issues.map((i, n) => (
                    <div key={n} className="flex flex-wrap items-center gap-3 rounded-2xl bg-hover px-4 py-3">
                      <IssueBadge type={i.type} />
                      <code className="rounded-md border bg-card px-2 py-0.5 text-sm">{i.span}</code>
                      <span className="min-w-48 flex-1 text-sm text-muted">{i.explanation}</span>
                      <span className="text-xs font-bold uppercase" style={{ color: SEVERITY_META[i.severity].color }}>{i.severity}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {(cur.suggested_rewrite || editing) && (
              <Section title={cur.suggested_rewrite ? 'Suggested rewrite' : 'Your correction'}>
                {editing
                  ? <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="w-full rounded-2xl border bg-card p-4 text-[16px] leading-7 outline-none focus:ring-2 focus:ring-primary/30" />
                  : <div className="rounded-2xl border bg-card p-4"><DiffView before={cur.original} after={cur.final_text ?? cur.suggested_rewrite ?? cur.original} /></div>}
              </Section>
            )}

            {cur.clarifying_questions.length > 0 && (
              <Section title="Clarifying questions">
                <ul className="space-y-2">{cur.clarifying_questions.map((c) => <li key={c} className="flex items-start gap-2.5 text-sm"><HelpCircle size={16} className="mt-0.5 shrink-0 text-primary" />{c}</li>)}</ul>
              </Section>
            )}

            {cur.is_ambiguous && (
              <div className="mt-8 flex flex-wrap items-center gap-2 border-t pt-6">
                {editing ? (
                  <><Button onClick={() => { decide.mutate({ rid: cur.id, d: 'edited', text: draft }); setEditing(false) }}><Check size={16} />Save edit</Button>
                    <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button></>
                ) : (
                  <>{cur.suggested_rewrite && <Button variant="success" onClick={() => decide.mutate({ rid: cur.id, d: 'accepted' })} disabled={cur.decision === 'accepted'}><Check size={16} />Accept</Button>}
                    <Button variant="ghost" onClick={() => { setDraft(cur.final_text ?? cur.suggested_rewrite ?? cur.original); setEditing(true) }}><Pencil size={16} />Edit</Button>
                    <Button variant="danger" onClick={() => decide.mutate({ rid: cur.id, d: 'rejected' })}><X size={16} />Reject</Button></>
                )}
                <IconButton label="Copy rewrite" className="ml-auto" onClick={() => navigator.clipboard?.writeText(cur.final_text ?? cur.suggested_rewrite ?? '')}><Copy size={16} /></IconButton>
              </div>
            )}
            {failed && <p role="alert" className="mt-3 text-sm text-negative">{failed}</p>}
          </Card>
        )}
      </div>
    </>
  )
}
function ExportMenu({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  const items = [{ f: 'docx', label: 'Word (.docx)', icon: FileText }, { f: 'csv', label: 'Excel (.csv)', icon: Table }, { f: 'json', label: 'JSON', icon: Download }] as const
  return (
    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false) }}>
      <IconButton label="Export" onClick={() => setOpen((o) => !o)}><Download size={18} /></IconButton>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-44 rounded-xl border bg-card p-1 shadow-lg">
          {items.map(({ f, label, icon: Icon }) => (
            <a key={f} href={exportUrl(id, f)} download onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-hover"><Icon size={16} className="text-muted" />{label}</a>
          ))}
        </div>
      )}
    </div>
  )
}
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mt-7"><h3 className="mb-3 text-xs font-bold tracking-wider text-muted uppercase">{title}</h3>{children}</div>
)
