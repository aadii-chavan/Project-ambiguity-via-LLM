import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, TrendingDown, TrendingUp } from 'lucide-react'
import { animate, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      className={cn('rounded-[20px] border bg-card', className)}>{children}</motion.div>
  )
}

export function IconButton({ children, onClick, label, className }: { children: ReactNode; onClick?: () => void; label: string; className?: string }) {
  return (
    <button aria-label={label} title={label} onClick={onClick}
      className={cn('grid size-10 cursor-pointer place-items-center rounded-xl border bg-card text-ink transition hover:bg-hover', className)}>{children}</button>
  )
}

export function Button({ variant = 'primary', className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'success' }) {
  const v = {
    primary: 'bg-primary text-white hover:bg-primaryhover',
    ghost: 'border bg-card text-ink hover:bg-hover',
    danger: 'border bg-card text-negative hover:bg-negative/10',
    success: 'bg-positive text-white hover:opacity-90',
  }[variant]
  return <button {...p} className={cn('inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50', v, className)} />
}

export function Select<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}
        className="h-10 w-full cursor-pointer appearance-none rounded-xl border bg-card pr-9 pl-3 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-primary/30">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted" />
    </div>
  )
}

export function SubTabs({ tabs, value, onChange }: { tabs: string[]; value: string; onChange: (t: string) => void }) {
  return (
    <div className="flex gap-6 border-b border-transparent">
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)}
          className={cn('relative cursor-pointer pb-3 text-sm font-medium transition', value === t ? 'text-ink' : 'text-muted hover:text-ink')}>
          {t}
          {value === t && <motion.span layoutId="subtab" className="absolute inset-x-0 -bottom-px h-0.5 rounded bg-ink" />}
        </button>
      ))}
    </div>
  )
}

export function PageHeader({ title, subtitle, right, tabs }: { title: string; subtitle?: string; right?: ReactNode; tabs?: ReactNode }) {
  return (
    <div className="px-6 pt-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] leading-tight font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">{right}</div>
      </div>
      {tabs && <div className="mt-6">{tabs}</div>}
    </div>
  )
}

/** Number with muted tail, e.g. "86" + ".4" — the reference's "$1 248,320" treatment. */
export function MutedNumber({ value, decimals = 0, suffix = '', prefix = '' }: { value: number; decimals?: number; suffix?: string; prefix?: string }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const c = animate(0, value, { duration: 0.9, ease: 'easeOut', onUpdate: setV })
    return () => c.stop()
  }, [value])
  const [int, dec] = v.toFixed(decimals).split('.')
  return (
    <span className="text-4xl font-bold tracking-tight tabular-nums">
      {prefix}{int}{dec !== undefined && <span className="text-mutednum">.{dec}</span>}
      {suffix && <span className="text-mutednum">{suffix}</span>}
    </span>
  )
}

export function Trend({ delta, goodWhenDown }: { delta: number; goodWhenDown?: boolean }) {
  if (Math.abs(delta) < 0.05) return <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted">No change</span>
  const down = delta < 0
  const good = goodWhenDown ? down : !down
  const Icon = down ? TrendingDown : TrendingUp
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm font-semibold', good ? 'text-positive' : 'text-negative')}>
      <Icon size={16} />{Math.abs(delta).toFixed(1)}%
    </span>
  )
}

export function KpiCard({ label, value, decimals, suffix, delta, goodWhenDown, note = 'vs previous session' }: {
  label: string; value: number; decimals?: number; suffix?: string; delta: number; goodWhenDown?: boolean; note?: string
}) {
  return (
    <div className="px-6 py-6 sm:px-8">
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-4"><MutedNumber value={value} decimals={decimals} suffix={suffix} /></div>
      <div className="mt-3 flex items-center gap-3 text-sm text-muted">{note}<Trend delta={delta} goodWhenDown={goodWhenDown} /></div>
    </div>
  )
}

/** Vertical tick meter from the reference's "Allocation" column. */
export function SegmentedMeter({ pct, ticks = 28, color = 'var(--positive)' }: { pct: number; ticks?: number; color?: string }) {
  const on = Math.round((pct / 100) * ticks)
  return (
    <div className="flex h-5 items-center gap-[3px]" role="img" aria-label={`${pct.toFixed(0)}%`}>
      {Array.from({ length: ticks }, (_, i) => (
        <span key={i} className="h-full w-[3px] rounded-full" style={{ background: i < on ? color : 'var(--border)' }} />
      ))}
    </div>
  )
}

export function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r
  const color = score >= 85 ? 'var(--positive)' : score >= 60 ? 'var(--warning)' : 'var(--negative)'
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: 'stroke-dashoffset .6s' }} />
      </svg>
      <span className="absolute text-xs font-bold tabular-nums">{score}</span>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-hover', className)} />
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center px-6 py-20 text-center">
      <div className="max-w-sm">
        <div className="text-lg font-bold">{title}</div>
        <p className="mt-1 mb-5 text-sm text-muted">{body}</p>
        {action}
      </div>
    </div>
  )
}
