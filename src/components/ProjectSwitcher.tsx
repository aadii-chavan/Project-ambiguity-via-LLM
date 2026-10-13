import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, FolderKanban, Plus } from 'lucide-react'
import { api } from '@/api/client'
import { useProject } from '@/lib/project'
import { cn } from '@/lib/utils'

export default function ProjectSwitcher() {
  const { projects, current, setCurrent, loading } = useProject()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const close = () => { setOpen(false); setAdding(false); setName(''); create.reset() }

  const create = useMutation({
    mutationFn: (n: string) => api.createProject(n),
    onSuccess: (p) => { qc.invalidateQueries({ queryKey: ['projects'] }); setCurrent(p.id); close() },
  })

  return (
    <div ref={ref} className="relative" onKeyDown={(e) => { if (e.key === 'Escape') close() }}>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label="Switch project"
        className="flex h-10 max-w-60 cursor-pointer items-center gap-2 rounded-xl px-2 text-sm font-semibold hover:bg-hover">
        <FolderKanban size={18} className="shrink-0" />
        <span className="truncate">{loading ? 'Loading…' : current?.name ?? 'No project'}</span>
        <ChevronDown size={16} className="shrink-0 text-muted" />
      </button>
      {open && (
        <div className="absolute left-0 z-40 mt-1 w-72 rounded-2xl border bg-card p-1.5 shadow-xl">
          <div role="listbox" aria-label="Projects" className="scroll-thin max-h-64 overflow-y-auto">
            {projects.map((p) => (
              <button key={p.id} role="option" aria-selected={p.id === current?.id} onClick={() => { setCurrent(p.id); close() }}
                className={cn('flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-hover', p.id === current?.id && 'bg-tint')}>
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <span className="text-xs text-muted">{p.session_count} {p.session_count === 1 ? 'analysis' : 'analyses'}</span>
                {p.id === current?.id && <Check size={16} className="text-primary" />}
              </button>
            ))}
          </div>
          <div className="mt-1 border-t pt-1.5">
            {adding ? (
              <form className="p-1.5" onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(name) }}>
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Project name" aria-label="New project name"
                  className="h-10 w-full rounded-xl border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                {create.isError && <p role="alert" className="mt-1.5 text-xs text-negative">{create.error.message}</p>}
                <div className="mt-2 flex gap-2">
                  <button type="submit" disabled={!name.trim() || create.isPending} className="h-9 flex-1 cursor-pointer rounded-xl bg-primary text-sm font-semibold text-white disabled:opacity-50">Create</button>
                  <button type="button" onClick={() => { setAdding(false); setName(''); create.reset() }} className="h-9 cursor-pointer rounded-xl border px-3 text-sm font-semibold hover:bg-hover">Cancel</button>
                </div>
              </form>
            ) : (
              <button onClick={() => setAdding(true)} className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-primary hover:bg-hover">
                <Plus size={16} />New project
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
