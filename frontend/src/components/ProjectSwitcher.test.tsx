import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProjectSwitcher from './ProjectSwitcher'
import { mockApi, P1, P2, renderApp } from '@/test/mockApi'

afterEach(() => vi.unstubAllGlobals())

describe('ProjectSwitcher', () => {
  it('lists real projects with counts and switches (and remembers) the selection', async () => {
    mockApi({ 'GET /api/projects': () => ({ body: [P1, P2] }) })
    renderApp(<ProjectSwitcher />)
    const trigger = await screen.findByRole('button', { name: 'Switch project' })
    await waitFor(() => expect(trigger).toHaveTextContent('Payments'))
    await userEvent.click(trigger)
    const list = screen.getByRole('listbox', { name: 'Projects' })
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['Payments2 analyses', 'Mobile0 analyses'])
    await userEvent.click(within(list).getByRole('option', { name: /Mobile/ }))
    expect(trigger).toHaveTextContent('Mobile')
    expect(localStorage.getItem('project')).toBe('p2')
  })

  it('creates a project, selects it, and surfaces duplicate-name errors', async () => {
    let created = false
    mockApi({
      'GET /api/projects': () => ({ body: created ? [P1, { id: 'p3', name: 'Billing', created_at: '2026-02-01T00:00:00Z', session_count: 0 }] : [P1] }),
      'POST /api/projects': (_u, init) => {
        const name = JSON.parse(init!.body as string).name
        if (name === 'Payments') return { status: 409, body: { detail: 'A project with that name already exists' } }
        created = true
        return { status: 201, body: { id: 'p3', name, created_at: '2026-02-01T00:00:00Z', session_count: 0 } }
      },
    })
    renderApp(<ProjectSwitcher />)
    await userEvent.click(await screen.findByRole('button', { name: 'Switch project' }))
    await userEvent.click(screen.getByRole('button', { name: /new project/i }))
    await userEvent.type(screen.getByLabelText('New project name'), 'Payments{enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists')
    await userEvent.clear(screen.getByLabelText('New project name'))
    await userEvent.type(screen.getByLabelText('New project name'), 'Billing{enter}')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Switch project' })).toHaveTextContent('Billing'))
  })

  it('falls back to the first project when the stored one no longer exists', async () => {
    mockApi({ 'GET /api/projects': () => ({ body: [P1] }) })
    renderApp(<ProjectSwitcher />)
    localStorage.setItem('project', 'deleted-project')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Switch project' })).toHaveTextContent('Payments'))
  })
})
