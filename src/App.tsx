import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ErrorBoundary from '@/components/ErrorBoundary'
import { ApiError } from '@/api/client'
import { ProjectProvider } from '@/lib/project'
import AppShell from '@/components/AppShell'
import Dashboard from '@/pages/Dashboard'
import Analyze from '@/pages/Analyze'
import Requirements from '@/pages/Requirements'
import History from '@/pages/History'
import Settings from '@/pages/Settings'

const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000, retry: (n, e) => n < 1 && !(e instanceof ApiError && e.status >= 400 && e.status < 500) } } })

export default function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={qc}>
      <ProjectProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="analyze" element={<Analyze />} />
            <Route path="requirements/:id?" element={<Requirements />} />
            <Route path="history" element={<History />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </ProjectProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  )
}
