// Regenerates docs/screenshots/*.png from a running app.  Usage: BASE_URL=http://localhost:8000 node scripts/screenshots.mjs
import { chromium } from '../frontend/node_modules/@playwright/test/index.mjs'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = process.env.BASE_URL ?? 'http://localhost:8000'
const OUT = fileURLToPath(new URL('../docs/screenshots/', import.meta.url)) // not .pathname: it percent-encodes spaces
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const shot = async (page, name, fullPage = true) => { await page.waitForTimeout(1500); await page.screenshot({ path: `${OUT}${name}.png`, fullPage }); console.log('saved', name) }  // overlays: viewport only, a fixed backdrop doesn't span a full-page capture

for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 })
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme)
  const page = await ctx.newPage()
  const sfx = theme === 'dark' ? '-dark' : ''

  await page.goto(BASE + '/')
  await page.waitForSelector('text=Quality trends')
  await shot(page, `dashboard${sfx}`)

  if (theme === 'light') {
    await page.getByRole('button', { name: 'Switch project' }).click()
    await shot(page, 'projects', false)
    await page.keyboard.press('Escape')
    await page.mouse.click(5, 5)
    await page.keyboard.press('Control+k')
    await page.getByRole('dialog').getByRole('textbox', { name: 'Search' }).fill('patient')
    await page.waitForSelector('mark')
    await shot(page, 'search', false)
    await page.keyboard.press('Escape')
    await page.goto(BASE + '/analyze')
    await page.getByRole('button', { name: 'E-commerce' }).click()
    await shot(page, 'analyze')
    await page.goto(BASE + '/history')
    await page.waitForSelector('text=Ambiguity rate')
    await shot(page, 'history')
  }

  await page.goto(BASE + '/requirements')
  await page.waitForSelector('text=Suggested rewrite')
  await shot(page, `requirements${sfx}`)
  await ctx.close()
}
await browser.close()
