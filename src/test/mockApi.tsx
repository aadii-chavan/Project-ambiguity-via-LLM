import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProjectProvider } from '@/lib/project'

type Handler = (url: string, init?: RequestInit) => { status?: number; body?: unknown }
export const P1 = { id: 'p1', name: 'Payments', created_at: '2026-01-01T00:00:00Z', session_count: 2 }
export const P2 = { id: 'p2', name: 'Mobile', created_at: '2026-01-02T00:00:00Z', session_count: 0 }

/** Stubs fetch with a tiny router. Unmatched requests fail the test loudly. Returns the call log. */
export function mockApi(routes: Record<string, Handler>) {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    const key = Object.keys(routes).find((k) => `${init?.method ?? 'GET'} ${url}`.startsWith(k))
    if (!key) throw new Error(`Unmocked request: ${init?.method ?? 'GET'} ${url}`)
    const { status = 200, body } = routes[key](url, init)
    return new Response(body === undefined ? null : JSON.stringify(body), { status })
  }))
  return calls
}

export const LocationProbe = () => <div data-testid="loc">{useLocation().pathname + useLocation().search}</div>

export function renderApp(ui: ReactElement, path = '/', selectedProject?: string) {
  localStorage.clear()
  if (selectedProject) localStorage.setItem('project', selectedProject)
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <ProjectProvider>
        <MemoryRouter initialEntries={[path]}>
          <LocationProbe />
          <Routes><Route path="*" element={ui} /></Routes>
        </MemoryRouter>
      </ProjectProvider>
    </QueryClientProvider>,
  )
}
