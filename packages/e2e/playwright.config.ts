import { defineConfig, devices } from '@playwright/test';

const serverUrl = 'http://127.0.0.1:3201';
const webUrl = 'http://127.0.0.1:5273';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 5_000 },
  reporter: 'line',
  use: {
    baseURL: webUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome']
  },
  webServer: [
    {
      command: 'pnpm --filter @circuit/server exec tsx src/index.ts',
      url: `${serverUrl}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        NODE_ENV: 'test',
        PORT: '3201',
        DATABASE_DISABLED: 'true',
        SESSION_SECRET: 'e2e-circuit-estates-secret-with-at-least-32-characters',
        CORS_ORIGINS: webUrl,
        LOG_LEVEL: 'silent'
      }
    },
    {
      command: 'pnpm --filter @circuit/web exec vite --host 127.0.0.1 --port 5273',
      url: webUrl,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { VITE_SERVER_URL: serverUrl }
    }
  ]
});
