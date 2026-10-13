import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Download, FileText, Table } from 'lucide-react'
import { api, exportUrl } from '@/api/client'
import EngineBanner from '@/components/EngineBanner'
import TrendChart from '@/components/TrendChart'
import { Button, Card, EmptyState, IconButton, KpiCard, PageHeader, SegmentedMeter, Select, Skeleton, SubTabs } from '@/components/ui'
import { useProject } from '@/lib/project'
import { fmtDate, ISSUE_META, SEVERITY_META } from '@/lib/utils'
import type { AnalysisSession, IssueType } from '@/types'

const pctDelta = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0)
const PERIODS = [{ value: 'all', label: 'All time' }, { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }]
const TABS = ['Overview', 'Issue types', 'Reports']

const csvCell = (v: string | number) => {
  const s = String(v)
  return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"` // neutralise spreadsheet formulas
}
function downloadSummary(project: string, sessions: AnalysisSession[]) {
  const rows = [['analysis', 'date', 'requirements', 'ambiguous', 'ambiguity_rate_pct', 'quality_before', 'quality_after']]
  sessions.forEach((s) => rows.push([s.name, s.created_at.slice(0, 10), s.summary.total, s.summary.ambiguous,
    (s.summary.ambiguity_rate * 100).toFixed(1), s.summary.avg_quality_before, s.summary.avg_quality_after] as never))
  const blob = new Blob(['﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv' })
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${project.replace(/[^\w.-]+/g, '_')}-summary.csv` })
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function Dashboard() {
  const { current } = useProject()
  const { data, isError, error } = useQuery({
    queryKey: ['sessions', current?.id], queryFn: () => api.listSessions(current!.id), enabled: !!current,
  })
  const [tab, setTab] = useState('Overview')
  const [period, setPeriod] = useState('all')

  const sessions = useMemo(() => {
    if (!data) return undefined
    if (period === 'all') return data
    const cutoff = Date.now() - Number(period) * 86_400_000
    return data.filter((s) => new Date(s.created_at).getTime() >= cutoff)
  }, [data, period])

  const m = useMemo(() => {
    if (!sessions?.length) return null
    const [cur, prev = cur] = sessions
    const trend = [...sessions].reverse().map((s, i) => ({ label: `#${i + 1}`, date: s.created_at, before: s.summary.avg_quality_before, after: s.summary.avg_quality_after }))
    const types: Partial<Record<IssueType, number>> = {}
    const sev = { high: 0, medium: 0, low: 0 }
    let reqs = 0, amb = 0
    sessions.forEach((s) => {
      reqs += s.summary.total; amb += s.summary.ambiguous
      Object.entries(s.summary.by_type).forEach(([k, v]) => (types[k as IssueType] = (types[k as IssueType] ?? 0) + (v ?? 0)))
      ;(Object.keys(sev) as (keyof typeof sev)[]).forEach((k) => (sev[k] += s.summary.by_severity[k]))
    })
    const typeRows = Object.entries(types).sort((a, b) => b[1]! - a[1]!) as [IssueType, number][]
    return { cur, prev, trend, typeRows, typeTotal: typeRows.reduce((s, [, v]) => s + v, 0), sev, reqs, amb }
  }, [sessions])

  const header = (
    <PageHeader title="Dashboard" subtitle={current ? `Requirement quality in ${current.name}` : undefined}
      right={<>
        <Select value={period} onChange={setPeriod} className="w-40" options={PERIODS} />
        <IconButton label="Download summary (CSV)" onClick={() => current && sessions?.length && downloadSummary(current.name, sessions)}><Download size={18} /></IconButton>
      </>}
      tabs={<SubTabs tabs={TABS} value={tab} onChange={setTab} />} />
  )

  if (isError) return <><PageHeader title="Dashboard" /><EmptyState title="Can't load data" body={error.message} /></>
  if (!current || !sessions) return <div className="space-y-4 p-8"><Skeleton className="h-10 w-60" /><Skeleton className="h-28" /><Skeleton className="h-72" /></div>
  if (!data?.length)
    return <><PageHeader title="Dashboard" subtitle={`Requirement quality in ${current.name}`} /><EngineBanner />
      <EmptyState title={`No analyses in ${current.name} yet`} body="Analyze a set of requirements to see quality metrics here." action={<Link to="/analyze"><Button>Analyze requirements</Button></Link>} /></>
  if (!m)
    return <>{header}<EmptyState title="No analyses in this period" body="Try a longer period to see earlier analyses." action={<Button variant="ghost" onClick={() => setPeriod('all')}>Show all time</Button>} /></>

  const { cur, prev } = m
  const sevTotal = m.sev.high + m.sev.medium + m.sev.low + (m.reqs - m.amb)
  const segs = [
    { k: 'High severity', v: m.sev.high, bg: 'var(--primary)' },
    { k: 'Medium severity', v: m.sev.medium, bg: 'var(--primary-soft)' },
    { k: 'Low severity', v: m.sev.low, bg: 'var(--primary-tint)' },
    { k: 'Clean requirements', v: m.reqs - m.amb, bg: 'hatch' },
  ]
  const typeTable = (limit: number) => (
    <Card className="p-6">
      <h2 className="mb-5 text-base font-bold">Issue types</h2>
      {m.typeRows.length === 0 && <p className="text-sm text-muted">No issues found in this period.</p>}
      {m.typeRows.length > 0 && <div className="grid grid-cols-[1.4fr_.6fr_1.6fr_.6fr] gap-3 px-3 pb-2 text-sm text-muted"><span>Type</span><span>Share</span><span>Distribution</span><span className="text-right">Count</span></div>}
      <div className="space-y-2">
        {m.typeRows.slice(0, limit).map(([k, v]) => {
          const meta = ISSUE_META[k], share = (v / m.typeTotal) * 100
          return (
            <div key={k} className="grid grid-cols-[1.4fr_.6fr_1.6fr_.6fr] items-center gap-3 rounded-2xl bg-hover px-3 py-3.5">
              <span className="flex items-center gap-2.5 text-sm font-medium"><span className="size-3 rounded-full" style={{ background: meta.color }} />{meta.label}</span>
              <span className="text-sm font-semibold text-primary">{share.toFixed(0)}%</span>
              <SegmentedMeter pct={share * 2.2} ticks={22} />
              <span className="text-right text-base font-bold tabular-nums">{v}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )

  return (
    <>
      {header}
      <EngineBanner />
      <div className="mt-6 grid grid-cols-1 divide-y border-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        <KpiCard label="Requirements analyzed" value={m.reqs} delta={pctDelta(m.reqs, m.reqs - cur.summary.total)} note="since last analysis" />
        <KpiCard label="Ambiguity rate" value={cur.summary.ambiguity_rate * 100} decimals={1} suffix="%" delta={pctDelta(cur.summary.ambiguity_rate, prev.summary.ambiguity_rate)} goodWhenDown note="latest vs previous" />
        <KpiCard label="Avg quality (after)" value={cur.summary.avg_quality_after} decimals={1} delta={pctDelta(cur.summary.avg_quality_after, prev.summary.avg_quality_after)} note="latest vs previous" />
        <KpiCard label="Ambiguous in latest" value={cur.summary.ambiguous} delta={pctDelta(cur.summary.ambiguous, prev.summary.ambiguous)} goodWhenDown note="latest vs previous" />
      </div>

      {tab === 'Overview' && (
        <>
          <Card className="mx-6 mt-6 p-6 sm:mx-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold">Quality trends</h2>
              <div className="flex items-center gap-5 text-sm font-medium"><Legend c="var(--primary)" t="After correction" /><Legend c="var(--secondary)" t="Before" /></div>
            </div>
            <div className="mt-4">
              {m.trend.length < 2
                ? <p className="grid h-[260px] place-items-center text-center text-sm text-muted">Run at least two analyses in this project to see a quality trend.</p>
                : <TrendChart data={m.trend} />}
            </div>
          </Card>
          <div className="mx-6 mt-6 grid gap-6 sm:mx-8 lg:grid-cols-2">
            {typeTable(5)}
            <Card className="p-6">
              <h2 className="mb-5 text-base font-bold">Severity structure</h2>
              <div className="grid grid-cols-4 gap-2">
                {segs.map((s) => <div key={s.k}><div className="text-xs text-muted">{s.k}</div><div className="mt-1 text-lg font-bold tabular-nums">{s.v}</div></div>)}
              </div>
              <div className="mt-8 flex h-12 gap-1">
                {segs.map((s) => (
                  <div key={s.k} className={s.bg === 'hatch' ? 'hatch rounded-2xl border' : 'rounded-2xl'}
                    style={{ flex: Math.max(s.v, 1) / sevTotal, background: s.bg === 'hatch' ? undefined : s.bg }} title={`${s.k}: ${s.v}`} />
                ))}
              </div>
              <div className="mt-2 flex gap-1 text-sm text-muted">
                {segs.map((s) => <div key={s.k} style={{ flex: Math.max(s.v, 1) / sevTotal }}>{((s.v / sevTotal) * 100).toFixed(0)}%</div>)}
              </div>
              <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted">
                {(['high', 'medium', 'low'] as const).map((k) => <span key={k}><b style={{ color: SEVERITY_META[k].color }}>{SEVERITY_META[k].weight}</b> pts penalty · {SEVERITY_META[k].label}</span>)}
              </div>
            </Card>
          </div>
        </>
      )}

      {tab === 'Issue types' && <div className="mx-6 mt-6 sm:mx-8">{typeTable(10)}</div>}

      {tab === 'Reports' && (
        <Card className="mx-6 mt-6 overflow-x-auto p-3 sm:mx-8">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[2fr_1fr_.7fr_1fr_1fr_120px] gap-3 px-4 py-3 text-sm text-muted"><span>Analysis</span><span>Date</span><span>Reqs</span><span>Ambiguous</span><span>Quality</span><span /></div>
            <div className="space-y-2">
              {sessions.map((s) => (
                <div key={s.id} className="grid grid-cols-[2fr_1fr_.7fr_1fr_1fr_120px] items-center gap-3 rounded-2xl bg-hover px-4 py-3">
                  <Link to={`/requirements/${s.id}`} className="truncate text-sm font-semibold hover:text-primary">{s.name}</Link>
                  <span className="text-sm text-muted">{fmtDate(s.created_at)}</span>
                  <span className="text-sm font-semibold tabular-nums">{s.summary.total}</span>
                  <span className="text-sm tabular-nums">{s.summary.ambiguous} ({(s.summary.ambiguity_rate * 100).toFixed(0)}%)</span>
                  <span className="text-sm font-bold text-positive tabular-nums">{s.summary.avg_quality_before.toFixed(0)} → {s.summary.avg_quality_after.toFixed(0)}</span>
                  <span className="flex justify-end gap-1.5">
                    <a href={exportUrl(s.id, 'docx')} download aria-label={`Download ${s.name} as Word`} title="Word (.docx)" className="grid size-9 place-items-center rounded-xl border bg-card hover:bg-hover"><FileText size={16} /></a>
                    <a href={exportUrl(s.id, 'csv')} download aria-label={`Download ${s.name} as CSV`} title="Excel (.csv)" className="grid size-9 place-items-center rounded-xl border bg-card hover:bg-hover"><Table size={16} /></a>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </>
  )
}
const Legend = ({ c, t }: { c: string; t: string }) => <span className="flex items-center gap-2"><span className="h-4 w-1 rounded-full" style={{ background: c }} />{t}</span>
