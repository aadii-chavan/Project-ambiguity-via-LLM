import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { History, LayoutGrid, ListChecks, Moon, Search, Settings, ShieldCheck, Sun, Wand2 } from 'lucide-react'
import { IconButton } from './ui'
import ProjectSwitcher from './ProjectSwitcher'
import SearchPalette from './SearchPalette'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/analyze', label: 'Analyze', icon: Wand2 },
  { to: '/requirements', label: 'Requirements', icon: ListChecks },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function AppShell() {
  const { dark, toggle } = useTheme()
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearching((s) => !s) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div className="mx-auto max-w-[1440px] p-3 sm:p-5">
      <div className="min-h-[calc(100vh-40px)] overflow-hidden rounded-[28px] border bg-page shadow-[0_20px_60px_-30px_rgba(80,60,180,.35)]">
        <header className="flex flex-wrap items-center gap-3 px-6 py-4 sm:px-8">
          <div className="flex items-center gap-2.5 pr-3">
            <div className="grid size-9 place-items-center rounded-[10px] bg-primary text-white"><ShieldCheck size={20} /></div>
            <span className="text-xl font-bold tracking-tight">ReqClear</span>
          </div>
          <div className="hidden h-8 w-px bg-[var(--border)] sm:block" />
          <ProjectSwitcher />
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setSearching(true)} aria-label="Search" title="Search (Ctrl/⌘ K)"
              className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 text-sm text-muted transition hover:bg-hover">
              <Search size={18} className="text-ink" />
              <span className="hidden md:inline">Search requirements</span>
              <kbd className="hidden rounded-md border px-1.5 py-0.5 text-[11px] md:inline">⌘K</kbd>
            </button>
            <IconButton label="Toggle theme" onClick={toggle}>{dark ? <Sun size={18} /> : <Moon size={18} />}</IconButton>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b px-6 pb-3 sm:px-8">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="relative">
              {({ isActive }) => (
                <span className={cn('relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium whitespace-nowrap transition', isActive ? 'text-primary' : 'text-ink hover:bg-hover')}>
                  {isActive && <motion.span layoutId="navpill" className="absolute inset-0 rounded-xl bg-tint" transition={{ type: 'spring', duration: 0.4 }} />}
                  <Icon size={18} className="relative" /><span className="relative">{label}</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <main className="pb-8"><Outlet /></main>
      </div>
      <SearchPalette open={searching} onClose={() => setSearching(false)} />
    </div>
  )
}
