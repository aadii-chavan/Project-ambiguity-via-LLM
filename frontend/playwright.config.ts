import { defineConfig, devices } from '@playwright/test'

// Runs against an isolated backend (port 8100, throw-away DB, LLM disabled => deterministic, no API cost)
// and a separate Vite server (port 5199) proxied to it. Run with the conda env active so `python` resolves.
const PY = process.env.PYTHON_BIN ?? 'python'

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5199', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: [
    {
      command: `rm -f e2e.db && ${PY} -m uvicorn app.main:app --port 8100`,
      cwd: '../backend',
      url: 'http://localhost:8100/health',
      env: { LLM_ENABLED: 'false', DATABASE_URL: 'sqlite:///./e2e.db', GEMINI_API_KEY: '' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npx vite --port 5199 --strictPort',
      url: 'http://localhost:5199',
      env: { API_URL: 'http://localhost:8100' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
