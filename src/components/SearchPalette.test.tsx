import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchPalette from './SearchPalette'
import { mockApi, P1, P2, renderApp } from '@/test/mockApi'

afterEach(() => vi.unstubAllGlobals())

const hit = (rid: string, original: string, over = {}) => ({
  session_id: 's9', session_name: 'SRS v2', project_id: 'p2', project_name: 'Mobile', requirement_id: rid,
  original, is_ambiguous: true, matched_in: 'original', created_at: '2026-02-01T00:00:00Z', ...over,
})

describe('SearchPalette', () => {
  it('renders nothing when closed', () => {
    mockApi({ 'GET /api/projects': () => ({ body: [P1] }) })
    renderApp(<SearchPalette open={false} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('asks for 2+ characters, then searches and highlights the match', async () => {
    const calls = mockApi({
      'GET /api/projects': () => ({ body: [P1, P2] }),
      'GET /api/search': () => ({ body: [hit('R2', 'Passwords must be encrypted.')] }),
    })
    renderApp(<SearchPalette open onClose={() => {}} />)
    expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Search'), 'p')
    expect(calls.some((c) => c.url.startsWith('/api/search'))).toBe(false)           // too short: no request
    await userEvent.type(screen.getByLabelText('Search'), 'assword')
    expect(await screen.findByText('Mobile')).toBeInTheDocument()                    // project tag
    expect(document.querySelector('mark')?.textContent).toBe('Password')
    expect(calls.filter((c) => c.url.startsWith('/api/search')).map((c) => c.url)).toEqual(['/api/search?q=password'])
  })

  it('opens the hit in its project and requirement, via click or Enter', async () => {
    mockApi({
      'GET /api/projects': () => ({ body: [P1, P2] }),
      'GET /api/search': () => ({ body: [hit('R3', 'Orders ship fast.')] }),
    })
    const onClose = vi.fn()
    renderApp(<SearchPalette open onClose={onClose} />)
    await userEvent.type(screen.getByLabelText('Search'), 'orders')
    await screen.findByText('Mobile')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByTestId('loc')).toHaveTextContent('/requirements/s9?req=R3')
    expect(localStorage.getItem('project')).toBe('p2')
    expect(onClose).toHaveBeenCalled()
  })

  it('shows empty and error states; Escape closes', async () => {
    let fail = false
    mockApi({
      'GET /api/projects': () => ({ body: [P1] }),
      'GET /api/search': () => (fail ? { status: 500, body: { error: { message: 'Unexpected server error' } } } : { body: [] }),
    })
    const onClose = vi.fn()
    renderApp(<SearchPalette open onClose={onClose} />)
    await userEvent.type(screen.getByLabelText('Search'), 'zzz')
    expect(await screen.findByText(/No requirements match/)).toBeInTheDocument()
    fail = true
    await userEvent.clear(screen.getByLabelText('Search'))
    await userEvent.type(screen.getByLabelText('Search'), 'boom')
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Unexpected server error'))
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
