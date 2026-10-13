import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtDate } from '@/lib/utils'

export interface TrendPoint { label: string; date: string; before: number; after: number }

function DarkTooltip({ active, payload }: { active?: boolean; payload?: { payload: TrendPoint }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="min-w-44 rounded-2xl bg-tooltip p-4 text-white shadow-xl">
      <Row color="var(--primary)" v={`${p.after.toFixed(1)}`} k="After correction" />
      <Row color="var(--secondary)" v={`${p.before.toFixed(1)}`} k="Before" />
      <Row color="#6b6b85" v={`+${(p.after - p.before).toFixed(1)}`} k="Improvement" />
      <div className="mt-3 border-t border-white/10 pt-3 text-sm"><b>{p.label}</b> <span className="text-white/60">{fmtDate(p.date)}</span></div>
    </div>
  )
}
const Row = ({ color, v, k }: { color: string; v: string; k: string }) => (
  <div className="mb-1.5 flex items-center gap-3 text-[15px] font-bold" title={k}>
    <span className="h-5 w-1 rounded-full" style={{ background: color }} />{v}<span className="text-xs font-medium text-white/50">{k}</span>
  </div>
)

export default function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted)" strokeOpacity="0.28" strokeWidth="1.5" />
            </pattern>
            <linearGradient id="gAfter" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 13 }} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 13 }} />
          <Tooltip content={<DarkTooltip />} cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }} />
          <Area type="monotone" dataKey="after" stroke="var(--primary)" strokeWidth={2} fill="url(#gAfter)" activeDot={{ r: 5 }} animationDuration={900} />
          <Area type="monotone" dataKey="before" stroke="var(--secondary)" strokeWidth={2} fill="url(#hatch)" activeDot={{ r: 5 }} animationDuration={900} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
