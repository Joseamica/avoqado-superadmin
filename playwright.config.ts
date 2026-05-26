import { defineConfig, devices } from '@playwright/test'

// El puerto del dev server vive en `vite.config.ts` (server.port: 5177).
// Si lo cambias allá, sincronizá acá también — playwright espera el
// webServer en este URL exacto. Override con `PLAYWRIGHT_BASE_URL=…` cuando
// corras los tests contra un deploy distinto (preview, staging, etc.).
const DEV_SERVER_URL = 'http://localhost:5177'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? DEV_SERVER_URL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_NO_SERVER
    ? undefined
    : {
        command: 'npm run dev',
        url: DEV_SERVER_URL,
        reuseExistingServer: !process.env.CI,
        // CI cold-starts pueden tardar — 120s nos da margen vs los 60s
        // anteriores (vimos un timeout exacto en GitHub Actions con npm ci
        // recién hecho + primera compilación de Vite).
        timeout: 120_000,
      },
})
