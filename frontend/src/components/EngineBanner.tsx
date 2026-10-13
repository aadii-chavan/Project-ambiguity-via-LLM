import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { api } from '@/api/client'

/** Shown when the backend has no Gemini key, so results come from the rule-based fallback. */
export default function EngineBanner({ engine }: { engine?: 'llm' | 'rules' }) {
  const { data } = useQuery({ queryKey: ['health'], queryFn: api.health, retry: false })
  const offline = engine ? engine === 'rules' : data && !data.llm_configured
  if (!offline) return null
  return (
    <div role="status" className="mx-6 mt-6 flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm sm:mx-8">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
      <span><b>Offline rules mode.</b> {engine ? 'This analysis used keyword rules only (no rewrites).' : 'No Gemini API key is configured, so analyses use keyword rules only (no rewrites).'} Add <code className="rounded bg-hover px-1">GEMINI_API_KEY</code> to <code className="rounded bg-hover px-1">backend/.env</code> and restart the backend.</span>
    </div>
  )
}
