import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e/storybook',
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:6017',
    viewport: { width: 800, height: 600 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce'
  },
  projects: [{ name: 'storybook-chromium' }],
  webServer: {
    command: 'bun run storybook -- --port 6017 --ci --no-open',
    url: 'http://localhost:6017',
    reuseExistingServer: false,
    timeout: 120_000
  }
})
