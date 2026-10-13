import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Trash2 } from 'lucide-react'
import { api, exportUrl } from '@/api/client'
import { Button, Card, EmptyState, IconButton, PageHeader, SegmentedMeter, Skeleton } from '@/components/ui'
import { fmtDate } from '@/lib/utils'
import { useProject } from '@/lib/project'
import { Link } from 'react-router-dom'

export default function History() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const { current } = useProject()
  const { data, isError, error } = useQuery({ queryKey: ['sessions', current?.id], queryFn: () => api.listSessions(current!.id), enabled: !!current })
  const del = useMutation({
    mutationFn: api.deleteSession,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sessions'] }); qc.invalidateQueries({ queryKey: ['projects'] }) },
  })
  if (isError) return <><PageHeader title="History" /><EmptyState title="Can't load history" body={error.message} /></>
  if (data && !data.length)
    return <><PageHeader title="History" /><EmptyState title="No sessions yet" body="Analyses you run in this project will be listed here." action={<Link to="/analyze"><Button>Analyze requirements</Button></Link>} /></>
  return (
    <>
      <PageHeader title="History" subtitle={`All analyses in ${current?.name ?? 'this project'}`} />
      <Card className="mx-6 mt-6 overflow-x-auto p-3 sm:mx-8">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[2fr_1fr_.7fr_1.4fr_1fr_130px] gap-3 px-4 py-3 text-sm text-muted"><span>Session</span><span>Date</span><span>Reqs</span><span>Ambiguity rate</span><span>Quality Δ</span><span /></div>
          {!data && <div className="space-y-2 p-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>}
          <div className="space-y-2">
            {data?.map((s) => (
              <div key={s.id} className="grid grid-cols-[2fr_1fr_.7fr_1.4fr_1fr_130px] items-center gap-3 rounded-2xl bg-hover px-4 py-3 transition hover:ring-2 hover:ring-primary/20">
                <button onClick={() => nav(`/requirements/${s.id}`)} className="cursor-pointer truncate text-left text-sm font-semibold hover:text-primary">{s.name}</button>
                <span className="text-sm text-muted">{fmtDate(s.created_at)}</span>
                <span className="text-sm font-semibold tabular-nums">{s.summary.total}</span>
                <span className="flex items-center gap-3"><SegmentedMeter pct={s.summary.ambiguity_rate * 100} ticks={18} color="var(--primary)" /><b className="text-sm tabular-nums">{(s.summary.ambiguity_rate * 100).toFixed(0)}%</b></span>
                <span className="text-sm font-bold text-positive tabular-nums">{s.summary.avg_quality_before.toFixed(0)} → {s.summary.avg_quality_after.toFixed(0)}</span>
                <span className="flex justify-end gap-1.5">
                  <a href={exportUrl(s.id, 'docx')} download aria-label="Download Word report" title="Download .docx"><IconButton label="Download .docx" className="size-9"><Download size={16} /></IconButton></a>
                  <IconButton label="Delete session" className="size-9 hover:text-negative" onClick={() => { if (confirm(`Delete "${s.name}"?`)) del.mutate(s.id) }}><Trash2 size={16} /></IconButton>
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </>
  )
}
