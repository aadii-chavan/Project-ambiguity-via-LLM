import { useCallback, useState } from 'react'
import type { AnalyzeOptions } from '@/types'

type Defaults = Pick<AnalyzeOptions, 'strictness' | 'style'>
const KEY = 'reqclear.defaults'
const FALLBACK: Defaults = { strictness: 'balanced', style: 'shall' }

export function loadDefaults(): Defaults {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return {
      strictness: ['lenient', 'balanced', 'strict'].includes(v.strictness) ? v.strictness : FALLBACK.strictness,
      style: ['shall', 'user_story', 'free'].includes(v.style) ? v.style : FALLBACK.style,
    }
  } catch { return FALLBACK }
}

/** Default analysis options, persisted per browser and used to pre-fill the Analyze page. */
export function useDefaults() {
  const [d, setD] = useState<Defaults>(loadDefaults)
  const update = useCallback((patch: Partial<Defaults>) => {
    setD((prev) => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])
  return [d, update] as const
}
