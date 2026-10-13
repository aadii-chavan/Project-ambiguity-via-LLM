import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CornerDownLeft, Search, X } from 'lucide-react'
import { api } from '@/api/client'
import { useProject } from '@/lib/project'
import { cn, fmtDate } from '@/lib/utils'

function Highlight({ text, q }: { text: string; q: string }) {
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0 || !q) return <>{text}</>
  return <>{text.slice(0, i)}<mark className="rounded bg-tint px-0.5 font-semibold text-primary">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>
}

/** Global search over every analysed requirement (⌘K / Ctrl+K). */
export default function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate()
  const { setCurrent } = useProject()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 200); return () => clearTimeout(t) }, [q])
  useEffect(() => { if (open) { setQ(''); setDebounced(''); setActive(0); setTimeout(() => input.current?.focus(), 0) } }, [open])
  useEffect(() => setActive(0), [debounced])

  const { data = [], isFetching, isError, error } = useQuery({
    queryKey: ['search', debounced], queryFn: () => api.search(debounced), enabled: open && debounced.length >= 2,
  })
  const hits = useMemo(() => data, [data])

  const go = (i: number) => {
    const h = hits[i]
    if (!h) return
    setCurrent(h.project_id)
    nav(`/requirements/${h.session_id}?req=${encodeURIComponent(h.requirement_id)}`)
    onClose()
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') go(active)
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-label="Search requirements" onKeyDown={onKey} onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-[20px] border bg-card shadow-2xl">
        <div className="flex items-center gap-3 border-b px-5">
          <Search size={18} className="text-muted" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all requirements, rewrites and corrections…" aria-label="Search"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted/70" maxLength={100} />
          <button aria-label="Close search" onClick={onClose} className="cursor-pointer text-muted hover:text-ink"><X size={18} /></button>
        </div>
        <div className="scroll-thin max-h-[55vh] overflow-y-auto p-2">
          {debounced.length < 2 && <p className="p-8 text-center text-sm text-muted">Type at least 2 characters to search across all projects.</p>}
          {debounced.length >= 2 && isFetching && !hits.length && <p className="p-8 text-center text-sm text-muted">Searching…</p>}
          {isError && <p role="alert" className="p-8 text-center text-sm text-negative">{error.message}</p>}
          {debounced.length >= 2 && !isFetching && !isError && !hits.length && <p className="p-8 text-center text-sm text-muted">No requirements match “{debounced}”.</p>}
          {hits.map((h, i) => (
            <button key={`${h.session_id}-${h.requirement_id}`} onClick={() => go(i)} onMouseEnter={() => setActive(i)}
              className={cn('flex w-full cursor-pointer flex-col gap-1 rounded-2xl px-4 py-3 text-left transition', i === active ? 'bg-tint' : 'hover:bg-hover')}>
              <span className="text-sm leading-6"><Highlight text={h.original} q={debounced} /></span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <span className="rounded-full bg-hover px-2 py-0.5 font-semibold text-ink">{h.project_name}</span>
                <span>{h.session_name} · {h.requirement_id} · {fmtDate(h.created_at)}</span>
                {h.matched_in !== 'original' && <span className="font-semibold text-primary">matched in {h.matched_in === 'final' ? 'accepted text' : 'suggested rewrite'}</span>}
                {h.is_ambiguous && <span className="font-semibold text-negative">ambiguous</span>}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t px-5 py-2.5 text-xs text-muted">
          <span>↑↓ navigate</span><span className="flex items-center gap-1"><CornerDownLeft size={12} />open</span><span>esc close</span>
        </div>
      </div>
    </div>
  )
}
