import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Project } from '@/types'

interface Ctx { projects: Project[]; current?: Project; setCurrent: (id: string) => void; loading: boolean }
const ProjectCtx = createContext<Ctx>({ projects: [], setCurrent: () => {}, loading: true })

const read = () => { try { return localStorage.getItem('project') } catch { return null } }

/** Holds the selected project. Falls back to the first project if the stored one no longer exists. */
export function ProjectProvider({ children }: { children: ReactNode }) {
  const { data: projects = [], isLoading } = useQuery({ queryKey: ['projects'], queryFn: api.listProjects })
  const [id, setId] = useState<string | null>(read)
  const setCurrent = useCallback((next: string) => {
    setId(next)
    try { localStorage.setItem('project', next) } catch { /* private mode */ }
  }, [])
  const value = useMemo(
    () => ({ projects, current: projects.find((p) => p.id === id) ?? projects[0], setCurrent, loading: isLoading }),
    [projects, id, setCurrent, isLoading],
  )
  return <ProjectCtx.Provider value={value}>{children}</ProjectCtx.Provider>
}

export const useProject = () => useContext(ProjectCtx)
