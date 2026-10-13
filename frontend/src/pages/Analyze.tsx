import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileUp, Loader2, Sparkles, X } from 'lucide-react'
import { api } from '@/api/client'
import { SAMPLES } from '@/api/samples'
import { useProject } from '@/lib/project'
import { useDefaults } from '@/lib/settings'
import { Button, Card, PageHeader, Select } from '@/components/ui'
import type { AnalyzeOptions } from '@/types'

export default function Analyze() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [drag, setDrag] = useState(false)
  const { current } = useProject()
  const [defaults] = useDefaults()
  const [opts, setOpts] = useState<AnalyzeOptions>({ ...defaults, glossary: [] })
  const [upload, setUpload] = useState<File | null>(null)
  const file = useRef<HTMLInputElement>(null)

  const run = useMutation({
    mutationFn: () => (upload ? api.analyzeFile(upload, opts, current?.id) : api.analyze(text, opts, current?.id)),
    onSuccess: (s) => { qc.invalidateQueries({ queryKey: ['sessions'] }); qc.invalidateQueries({ queryKey: ['projects'] }); nav(`/requirements/${s.id}`) },
  })
  const readFile = async (f?: File) => {
    if (!f) return
    if (/\.(txt|md)$/i.test(f.name)) { setUpload(null); setText(await f.text()) }
    else { setUpload(f); setText('') } // .csv / .docx are parsed server-side
  }
  const lines = text.split(/\n+/).filter((l) => l.trim()).length
  const canRun = !!upload || lines > 0

  return (
    <>
      <PageHeader title="Analyze" subtitle={`Paste requirements or upload a file — one per line. Results are saved to ${current?.name ?? 'your project'}.`} />
      <div className="mx-6 mt-6 grid gap-6 sm:mx-8 lg:grid-cols-[1fr_320px]">
        <Card className="p-6">
          <div onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files[0]) }}
            className={`relative rounded-2xl border-2 border-dashed transition ${drag ? 'border-primary bg-tint' : ''}`}>
            {upload && (
              <div className="m-4 flex items-center gap-3 rounded-xl bg-tint px-4 py-3 text-sm font-medium text-primary">
                <FileUp size={16} />{upload.name} <span className="text-muted">({(upload.size / 1024).toFixed(1)} KB)</span>
                <button aria-label="Remove file" onClick={() => setUpload(null)} className="ml-auto cursor-pointer"><X size={16} /></button>
              </div>
            )}
            <textarea value={text} onChange={(e) => { setText(e.target.value); setUpload(null) }} rows={upload ? 6 : 12} spellCheck={false}
              placeholder={'The system should respond quickly to user queries.\nReports shall be generated for all borrowed books.\n…'}
              className="w-full resize-none rounded-2xl bg-transparent p-5 text-[15px] leading-7 outline-none placeholder:text-muted/60" />
            <div className="flex items-center justify-between border-t px-4 py-3">
              <button onClick={() => file.current?.click()} className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted hover:text-ink">
                <FileUp size={16} />Upload .txt / .md / .csv / .docx or drop here
              </button>
              <input ref={file} type="file" accept=".txt,.csv,.md,.docx" hidden onChange={(e) => readFile(e.target.files?.[0])} />
              <span className="text-sm text-muted">{upload ? 'file ready' : `${lines} requirement${lines === 1 ? '' : 's'}`}</span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm text-muted">Try a sample:</span>
            {SAMPLES.map((s) => (
              <button key={s.label} onClick={() => setText(s.text)} className="cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium transition hover:bg-tint hover:text-primary">{s.label}</button>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-5 p-6">
            <h2 className="text-base font-bold">Options</h2>
            <label className="block text-sm font-medium">Strictness
              <Select className="mt-2" value={opts.strictness} onChange={(v) => setOpts({ ...opts, strictness: v })}
                options={[{ value: 'lenient', label: 'Lenient — only clear issues' }, { value: 'balanced', label: 'Balanced' }, { value: 'strict', label: 'Strict — flag everything' }]} />
            </label>
            <label className="block text-sm font-medium">Rewrite style
              <Select className="mt-2" value={opts.style} onChange={(v) => setOpts({ ...opts, style: v })}
                options={[{ value: 'shall', label: '"The system shall…" (IEEE 830)' }, { value: 'user_story', label: 'User story' }, { value: 'free', label: 'Free form' }]} />
            </label>
            <label className="block text-sm font-medium">Glossary <span className="font-normal text-muted">(optional)</span>
              <input placeholder="SLA, PII, RBAC" onChange={(e) => setOpts({ ...opts, glossary: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                className="mt-2 h-10 w-full rounded-xl border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </label>
          </Card>
          <Button className="h-12 w-full text-base" disabled={!canRun || run.isPending || !current} onClick={() => run.mutate()}>
            {run.isPending ? <><Loader2 size={18} className="animate-spin" />Analyzing…</> : <><Sparkles size={18} />Analyze requirements</>}
          </Button>
          {run.isError && <p role="alert" className="text-sm text-negative">{run.error.message}</p>}
        </div>
      </div>
    </>
  )
}
