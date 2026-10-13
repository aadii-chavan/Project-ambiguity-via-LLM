import { expect, test, type APIRequestContext } from '@playwright/test'

const SAMPLE = [
  'The system should respond quickly to user queries.',
  'The librarian can export data in formats such as PDF, etc.',
  'The system shall lock a member account after 5 consecutive failed login attempts.',
].join('\n')

/** Reset to a known state: all analyses gone, extra projects gone, original project renamed back. */
async function reset(request: APIRequestContext) {
  const projects = await (await request.get('/api/projects')).json()
  for (const p of projects.slice(1)) await request.delete(`/api/projects/${p.id}`)
  await request.patch(`/api/projects/${projects[0].id}`, { data: { name: 'My first project' } })
  for (const s of await (await request.get('/api/sessions')).json()) await request.delete(`/api/sessions/${s.id}`)
}
async function seed(request: APIRequestContext, text = SAMPLE, projectId?: string) {
  const r = await request.post('/api/analyze', { data: { text, project_id: projectId } })
  expect(r.ok()).toBeTruthy()
  return (await r.json()) as { id: string }
}

test.beforeEach(async ({ request, page }) => {
  await reset(request)
  await page.addInitScript(() => localStorage.removeItem('project'))
})

test('empty dashboard explains offline mode and links to Analyze', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('No analyses in My first project yet')).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Offline rules mode')
  await page.getByRole('link', { name: 'Analyze requirements' }).click()
  await expect(page).toHaveURL(/\/analyze$/)
})

test('main flow: analyze → review → reject → dashboard → history → delete', async ({ page }) => {
  await page.goto('/analyze')
  const run = page.getByRole('button', { name: /analyze requirements/i })
  await expect(run).toBeDisabled()
  await page.getByRole('textbox').first().fill(SAMPLE)
  await expect(page.getByText('3 requirements')).toBeVisible()
  await run.click()

  await expect(page).toHaveURL(/\/requirements\/[0-9a-f]+$/)
  await expect(page.getByText('2 of 3 ambiguous')).toBeVisible()
  await expect(page.getByRole('status')).toContainText('keyword rules only')

  // detail pane highlights the vague words and offers no bogus "Accept" without a rewrite
  await expect(page.locator('mark', { hasText: 'quickly' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Reject' }).click()
  await expect(page.getByText('rejected', { exact: true }).first()).toBeVisible()

  // filters + search
  await page.getByRole('button', { name: 'clean', exact: true }).click()
  await expect(page.getByText('lock a member account').first()).toBeVisible()
  await expect(page.getByText('respond quickly')).toHaveCount(0)
  await page.getByRole('button', { name: 'all', exact: true }).click()
  await page.getByPlaceholder('Search requirements').fill('librarian')
  await expect(page.getByRole('button', { name: /R2/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /R1/ })).toHaveCount(0)

  await page.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByText('Requirements analyzed')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Issue types' })).toBeVisible()

  await page.getByRole('link', { name: 'History' }).click()
  await expect(page.getByRole('button', { name: /Analysis/ }).first()).toBeVisible()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Delete session' }).click()
  await expect(page.getByText('No sessions yet')).toBeVisible()
})

test('editing a flagged requirement saves the author\'s own correction', async ({ page, request }) => {
  const { id } = await seed(request)
  await page.goto(`/requirements/${id}`)
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByRole('textbox').last().fill('The system shall respond to user queries within 2 seconds.')
  await page.getByRole('button', { name: 'Save edit' }).click()
  await expect(page.getByText('edited', { exact: true }).first()).toBeVisible()
  const s = await (await request.get(`/api/sessions/${id}`)).json()
  expect(s.requirements[0]).toMatchObject({ decision: 'edited', final_text: 'The system shall respond to user queries within 2 seconds.' })
})

test('exports download as files', async ({ page, request }) => {
  const { id } = await seed(request)
  await page.goto(`/requirements/${id}`)
  for (const [label, ext] of [['Word (.docx)', 'docx'], ['Excel (.csv)', 'csv'], ['JSON', 'json']] as const) {
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: label }).click()])
    expect(dl.suggestedFilename()).toMatch(new RegExp(`\\.${ext}$`))
  }
})

test('file upload: csv is parsed server-side', async ({ page }) => {
  await page.goto('/analyze')
  await page.locator('input[type=file]').setInputFiles({
    name: 'reqs.csv', mimeType: 'text/csv',
    buffer: Buffer.from('id,Requirement\n1,The app must be intuitive.\n2,The server shall encrypt all passwords using bcrypt.\n'),
  })
  await expect(page.getByText('reqs.csv')).toBeVisible()
  await page.getByRole('button', { name: /analyze requirements/i }).click()
  await expect(page.getByText('1 of 2 ambiguous')).toBeVisible()
})

test('markup in a requirement is rendered as text, never executed', async ({ page, request }) => {
  const { id } = await seed(request, '<img src=x onerror="window.__pwned=1"> The system should be fast.')
  await page.goto(`/requirements/${id}`)
  await expect(page.getByText('<img src=x', { exact: false }).first()).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined()
  await expect(page.locator('main img')).toHaveCount(0)
})

test('API failure shows an error state instead of a blank page', async ({ page }) => {
  await page.route('**/api/sessions**', (r) => r.fulfill({ status: 500, json: { error: { code: 'internal_error', message: 'Unexpected server error' } } }))
  await page.goto('/')
  await expect(page.getByText("Can't load data")).toBeVisible()
  await expect(page.getByText('Unexpected server error')).toBeVisible()
})

test('dark mode persists across reloads', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Toggle theme' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
})

test('no horizontal scrolling at phone width', async ({ page, request }) => {
  const { id } = await seed(request)
  await page.setViewportSize({ width: 375, height: 800 })
  for (const path of ['/', '/analyze', `/requirements/${id}`, '/history', '/settings']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect.soft(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0)
  }
})


// ---------------------------------------------------------------- projects, search, dashboard, settings

const switcher = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Switch project' })

test('removed placeholder controls are gone (no bell, fake badge, fake user, dead buttons)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Notifications' })).toHaveCount(0)
  await expect(page.getByText('Aditya C.')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Customize' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'More' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add project' })).toHaveCount(0)
})

test('projects: create, scope every page to it, persist across reload, switch back', async ({ page, request }) => {
  await seed(request)                                   // one analysis in the default project
  await page.goto('/')
  await expect(switcher(page)).toContainText('My first project')
  await expect(page.getByText('Requirements analyzed')).toBeVisible()

  await switcher(page).click()
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByLabel('New project name').fill('Mobile app')
  await page.getByLabel('New project name').press('Enter')
  await expect(switcher(page)).toContainText('Mobile app')
  await expect(page.getByText('No analyses in Mobile app yet')).toBeVisible()   // dashboard is scoped

  await page.getByRole('link', { name: 'History' }).click()
  await expect(page.getByText('No sessions yet')).toBeVisible()                  // history is scoped
  await page.getByRole('navigation').getByRole('link', { name: 'Requirements' }).click()
  await expect(page.getByText('No analyses in Mobile app yet')).toBeVisible()    // requirements is scoped

  // analyze into the new project
  await page.getByRole('navigation').getByRole('link', { name: 'Analyze' }).click()
  await expect(page.getByText('saved to Mobile app')).toBeVisible()
  await page.getByRole('textbox').first().fill('The app must be intuitive.')
  await page.getByRole('button', { name: /analyze requirements/i }).click()
  await expect(page.getByText('1 of 1 ambiguous')).toBeVisible()

  // choice survives a reload; the other project still has only its own analysis
  await page.reload()
  await expect(switcher(page)).toContainText('Mobile app')
  await switcher(page).click()
  await expect(page.getByRole('option', { name: /My first project.*1 analysis/ })).toBeVisible()
  await expect(page.getByRole('option', { name: /Mobile app.*1 analysis/ })).toBeVisible()
  await page.getByRole('option', { name: /My first project/ }).click()
  await page.getByRole('link', { name: 'History' }).click()
  await expect(page.getByRole('button', { name: /Analysis/ })).toHaveCount(1)
  await expect(switcher(page)).toContainText('My first project')                  // switching away from another project's analysis sticks
  await expect(page.getByText('Mobile app')).toHaveCount(0)
})

test('projects: duplicate names are rejected with a message', async ({ page }) => {
  await page.goto('/')
  await switcher(page).click()
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByLabel('New project name').fill('my FIRST project')
  await page.getByLabel('New project name').press('Enter')
  await expect(page.getByRole('alert')).toContainText('already exists')
})

test('search: ⌘K finds requirements across projects and opens the exact one', async ({ page, request }) => {
  const other = await (await request.post('/api/projects', { data: { name: 'Hospital' } })).json()
  await seed(request, 'The system should respond quickly.\nUsers shall reset passwords by email.')
  const s2 = await seed(request, 'Patient passwords must be encrypted.\nThe portal shall support various devices.', other.id)
  await page.goto('/')
  await expect(switcher(page)).toContainText('My first project')

  await page.keyboard.press('Control+k')
  const dlg = page.getByRole('dialog', { name: 'Search requirements' })
  await expect(dlg).toBeVisible()
  await dlg.getByRole('textbox', { name: 'Search' }).fill('a')
  await expect(dlg.getByText(/at least 2 characters/)).toBeVisible()
  await dlg.getByRole('textbox', { name: 'Search' }).fill('PASSWORDS')
  await expect(dlg.getByRole('button')).toHaveCount(3)                            // 2 hits + close button
  await expect(dlg.getByText('Hospital', { exact: true })).toBeVisible()
  await expect(dlg.getByText('My first project', { exact: true })).toBeVisible()
  await dlg.getByRole('button', { name: /Patient passwords must be encrypted/ }).click()

  await expect(dlg).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`/requirements/${s2.id}\\?req=R1`))
  await expect(switcher(page)).toContainText('Hospital')                          // followed the hit into its project
  await expect(page.getByRole('heading', { name: 'R1' })).toBeVisible()
  await expect(page.locator('p', { hasText: 'Patient passwords must be encrypted.' }).first()).toBeVisible()
})

test('search: no results and Escape', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByRole('dialog').getByRole('textbox', { name: 'Search' }).fill('zzzzqqqq')
  await expect(page.getByText(/No requirements match/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('dashboard: tabs, period filter and CSV summary all work', async ({ page, request }) => {
  await seed(request)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Quality trends' })).toBeVisible()
  await expect(page.getByText('Run at least two analyses')).toBeVisible()          // honest empty chart

  await page.getByRole('button', { name: 'Issue types', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Issue types' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Quality trends' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Reports', exact: true }).click()
  await expect(page.getByRole('link', { name: /^Analysis/ })).toBeVisible()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /as Word/ }).click()])
  expect(dl.suggestedFilename()).toMatch(/\.docx$/)

  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download summary (CSV)' }).click()])
  expect(csv.suggestedFilename()).toBe('My_first_project-summary.csv')

  await page.getByRole('combobox').selectOption('7')                              // today's analysis is within 7 days
  await expect(page.getByText('Requirements analyzed')).toBeVisible()
})

test('settings: defaults persist into Analyze; projects can be renamed and deleted', async ({ page, request }) => {
  const extra = await (await request.post('/api/projects', { data: { name: 'Scratch' } })).json()
  await seed(request, SAMPLE, extra.id)
  await page.goto('/settings')
  await page.getByLabel('Strictness').selectOption('strict')
  await page.getByLabel('Rewrite style').selectOption('user_story')
  await expect(page.getByText(/claude|gemini/i).first()).toBeVisible()             // model shown read-only from /health

  await page.goto('/analyze')
  await expect(page.getByLabel('Strictness')).toHaveValue('strict')
  await expect(page.getByLabel('Rewrite style')).toHaveValue('user_story')

  await page.goto('/settings')
  await page.getByRole('button', { name: 'Rename Scratch' }).click()
  await page.getByLabel('Project name').fill('Archive')
  await page.getByRole('button', { name: 'Save name' }).click()
  await expect(page.getByText('Archive', { exact: true })).toBeVisible()

  page.once('dialog', (d) => { expect(d.message()).toContain('1 analysis'); d.accept() })
  await page.getByRole('button', { name: 'Delete Archive' }).click()
  await expect(page.getByText('Archive', { exact: true })).toHaveCount(0)
  expect((await (await request.get('/api/sessions')).json()).length).toBe(0)      // its analysis went with it
})
