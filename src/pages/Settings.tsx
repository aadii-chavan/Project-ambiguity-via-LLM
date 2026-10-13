import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Moon, Pencil, Sun, Trash2, X } from 'lucide-react'
import { api } from '@/api/client'
import { Card, IconButton, PageHeader, Select } from '@/components/ui'
import { useProject } from '@/lib/project'
import { useDefaults } from '@/lib/settings'
import { useTheme } from '@/lib/theme'
import type { AnalyzeOptions, Project } from '@/types'

function ProjectRow({ p, canDelete }: { p: Project; canDelete: boolean }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(p.name)
  const refresh = () => { qc.invalidateQueries({ queryKey: ['projects'] }); qc.invalidateQueries({ queryKey: ['sessions'] }) }
  const rename = useMutation({ mutationFn: () => api.renameProject(p.id, name), onSuccess: () => { refresh(); setEditing(false) } })
  const del = useMutation({ mutationFn: () => api.deleteProject(p.id), onSuccess: refresh })
  return (
    <div className="rounded-2xl bg-hover px-4 py-3">
      <div className="flex items-center gap-3">
        {editing ? (
          <form className="flex flex-1 items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) rename.mutate() }}>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Project name"
              className="h-9 flex-1 rounded-lg border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            <IconButton label="Save name" className="size-9" onClick={() => name.trim() && rename.mutate()}><Check size={16} /></IconButton>
            <IconButton label="Cancel" className="size-9" onClick={() => { setEditing(false); setName(p.name); rename.reset() }}><X size={16} /></IconButton>
          </form>
        ) : (
          <>
            <span className="flex-1 truncate text-sm font-semibold">{p.name}</span>
            <span className="text-xs text-muted">{p.session_count} {p.session_count === 1 ? 'analysis' : 'analyses'}</span>
            <IconButton label={`Rename ${p.name}`} className="size-9" onClick={() => setEditing(true)}><Pencil size={16} /></IconButton>
            <IconButton label={`Delete ${p.name}`} className="size-9 hover:text-negative" onClick={() => {
              if (!canDelete) return
              if (confirm(`Delete "${p.name}" and its ${p.session_count} ${p.session_count === 1 ? 'analysis' : 'analyses'}? This can't be undone.`)) del.mutate()
            }}><Trash2 size={16} className={canDelete ? '' : 'opacity-30'} /></IconButton>
          </>
        )}
      </div>
      {(rename.isError || del.isError) && <p role="alert" className="mt-2 text-xs text-negative">{(rename.error ?? del.error)?.message}</p>}
    </div>
  )
}

export default function Settings() {
  const { dark, toggle } = useTheme()
  const { projects } = useProject()
  const [d, update] = useDefaults()
  const { data: health } = useQuery({ queryKey: ['health'], queryFn: api.health, retry: false })
  return (
    <>
      <PageHeader title="Settings" subtitle="Defaults for new analyses, projects and appearance" />
      <div className="mx-6 mt-6 grid max-w-3xl gap-6 sm:mx-8">
        <Card className="space-y-5 p-6">
          <h2 className="text-base font-bold">Analysis defaults</h2>
          <label className="block text-sm font-medium">Strictness
            <Select className="mt-2" value={d.strictness} onChange={(v) => update({ strictness: v })}
              options={[{ value: 'lenient', label: 'Lenient — only clear issues' }, { value: 'balanced', label: 'Balanced' }, { value: 'strict', label: 'Strict — flag everything' }] as { value: AnalyzeOptions['strictness']; label: string }[]} />
          </label>
          <label className="block text-sm font-medium">Rewrite style
            <Select className="mt-2" value={d.style} onChange={(v) => update({ style: v })}
              options={[{ value: 'shall', label: '"The system shall…" (IEEE 830)' }, { value: 'user_story', label: 'User story' }, { value: 'free', label: 'Free form' }] as { value: AnalyzeOptions['style']; label: string }[]} />
          </label>
          <p className="text-xs text-muted">Saved in this browser and used to pre-fill the Analyze page.</p>
          <div className="border-t pt-4 text-sm">
            <div className="font-medium">Model</div>
            <p className="mt-1 text-muted">
              {health ? <><code className="rounded bg-hover px-1.5 py-0.5 text-ink">{health.model}</code>{health.llm_configured ? ' · connected' : ' · no API key — running in offline rules mode'}</> : 'Unavailable'}
              {' '}— set by <code className="rounded bg-hover px-1">LLM_MODEL</code> in <code className="rounded bg-hover px-1">backend/.env</code>.
            </p>
          </div>
        </Card>

        <Card className="space-y-3 p-6">
          <h2 className="text-base font-bold">Projects</h2>
          <p className="text-sm text-muted">Deleting a project also deletes all of its analyses. You must keep at least one project.</p>
          {projects.map((p) => <ProjectRow key={p.id} p={p} canDelete={projects.length > 1} />)}
        </Card>

        <Card className="flex items-center justify-between p-6">
          <div><h2 className="text-base font-bold">Appearance</h2><p className="text-sm text-muted">Switch between light and dark theme</p></div>
          <button onClick={toggle} className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-semibold hover:bg-hover">{dark ? <Sun size={16} /> : <Moon size={16} />}{dark ? 'Light' : 'Dark'} mode</button>
        </Card>
      </div>
    </>
  )
}
