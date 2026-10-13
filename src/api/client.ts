import type { AnalysisSession, AnalyzeOptions, Decision, Project, SearchHit } from '@/types'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, init)
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running on port 8000?', 0)
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const body = await res.json()
      const d = body?.error?.message ?? body?.detail
      msg = typeof d === 'string' ? d : Array.isArray(d) ? d.map((x: { msg: string }) => x.msg).join('; ') : msg
    } catch { /* non-JSON error body */ }
    throw new ApiError(msg, res.status)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

const json = (method: string, body: unknown): RequestInit => ({
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

export const exportUrl = (id: string, format: 'json' | 'csv' | 'docx') => `/api/sessions/${id}/export?format=${format}`

export const api = {
  listProjects: () => req<Project[]>('/projects'),
  createProject: (name: string) => req<Project>('/projects', json('POST', { name })),
  renameProject: (id: string, name: string) => req<Project>(`/projects/${id}`, json('PATCH', { name })),
  deleteProject: (id: string) => req<void>(`/projects/${id}`, { method: 'DELETE' }),
  search: (q: string) => req<SearchHit[]>(`/search?q=${encodeURIComponent(q)}`),
  listSessions: (projectId?: string) => req<AnalysisSession[]>(`/sessions${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''}`),
  getSession: (id: string) => req<AnalysisSession>(`/sessions/${id}`),
  deleteSession: (id: string) => req<void>(`/sessions/${id}`, { method: 'DELETE' }),
  health: async (): Promise<{ status: string; llm_configured: boolean; model: string }> => (await fetch('/health')).json(),
  analyze: (text: string, options: AnalyzeOptions, projectId?: string) => req<AnalysisSession>('/analyze', json('POST', { text, options, project_id: projectId })),
  analyzeFile: (file: File, o: AnalyzeOptions, projectId?: string) => {
    const f = new FormData()
    f.append('file', file)
    f.append('strictness', o.strictness)
    f.append('style', o.style)
    f.append('glossary', o.glossary.join(', '))
    if (projectId) f.append('project_id', projectId)
    return req<AnalysisSession>('/analyze/file', { method: 'POST', body: f })
  },
  decide: (sid: string, rid: string, decision: Decision, final_text?: string) =>
    req<AnalysisSession>(`/sessions/${sid}/requirements/${rid}`, json('PATCH', { decision, final_text })),
}
