import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Analyze from './Analyze'
import { mockApi, P1, P2, renderApp } from '@/test/mockApi'

afterEach(() => vi.unstubAllGlobals())
const projects = () => ({ body: [P1, P2] })

describe('Analyze page', () => {
  it('disables the button until there is input, and counts requirements', async () => {
    mockApi({ 'GET /api/projects': projects })
    renderApp(<Analyze />)
    const btn = await screen.findByRole('button', { name: /analyze requirements/i })
    expect(btn).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox', { name: '' }), 'The system shall do A.{enter}The system shall do B.')
    await waitFor(() => expect(btn).toBeEnabled())
    expect(screen.getByText('2 requirements')).toBeInTheDocument()
  })

  it('fills the text area from a sample chip and says where results are saved', async () => {
    mockApi({ 'GET /api/projects': projects })
    renderApp(<Analyze />)
    await userEvent.click(await screen.findByRole('button', { name: 'Healthcare' }))
    expect(screen.getByText('3 requirements')).toBeInTheDocument()
    expect(await screen.findByText(/saved to Payments/)).toBeInTheDocument()
  })

  it('submits into the selected project and navigates to the results', async () => {
    const calls = mockApi({ 'GET /api/projects': projects, 'POST /api/analyze': () => ({ body: { id: 'abc' } }), 'GET /api/sessions': () => ({ body: [] }) })
    renderApp(<Analyze />, '/', 'p2')
    await userEvent.click(await screen.findByRole('button', { name: 'Library system' }))
    await userEvent.click(screen.getByRole('button', { name: /analyze requirements/i }))
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/requirements/abc'))
    const post = calls.find((c) => c.init?.method === 'POST')!
    expect(JSON.parse(post.init!.body as string)).toMatchObject({ project_id: 'p2' }) // the project chosen in the switcher
  })

  it('shows the server error message when analysis fails', async () => {
    mockApi({ 'GET /api/projects': projects, 'POST /api/analyze': () => ({ status: 429, body: { detail: 'Too many analysis requests; please wait a minute' } }) })
    renderApp(<Analyze />)
    await userEvent.click(await screen.findByRole('button', { name: 'E-commerce' }))
    await userEvent.click(screen.getByRole('button', { name: /analyze requirements/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many analysis requests')
  })
})
