// Pruebas E2E del front con Playwright. Levanta la app con una base PostgreSQL de pruebas.
const { defineConfig, devices } = require('@playwright/test');

const PUERTO = Number(process.env.E2E_PORT || 3100);

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['json', { outputFile: 'playwright-report/resultados.json' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || `http://localhost:${PUERTO}`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'node src/server.js',
    url: `http://localhost:${PUERTO}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(PUERTO),
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/parcial2',
      JWT_SECRET: 'secreto-e2e',
      OTEL_SDK_DISABLED: 'true',
    },
  },
});
