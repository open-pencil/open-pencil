import { defineConfig } from '@playwright/test'

const e2eAppPort = Number(process.env.OPENPENCIL_E2E_APP_PORT ?? 1420)
const e2eBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${e2eAppPort}`
const isolatedE2EApp = process.env.OPENPENCIL_E2E_APP_PORT !== undefined

export default defineConfig({
  testDir: './tests',
  timeout: 15_000,
  workers: 1,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      threshold: 0.3
    },
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.01,
      threshold: 0.3
    }
  },
  use: {
    baseURL: e2eBaseURL,
    testIdAttribute: 'data-test-id',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    launchOptions: {
      args: ['--enable-unsafe-swiftshader']
    }
  },
  projects: [
    {
      name: 'openpencil',
      testDir: './tests/e2e',
      testIgnore: ['**/native/**'],
    },
    {
      name: 'openpencil-webkit',
      testDir: './tests/e2e',
      testMatch: [
        '**/*.webkit.spec.ts',
        '**/design/panel.spec.ts',
        '**/export/basic.spec.ts',
        '**/fonts/settings.spec.ts'
      ],
      use: {
        browserName: 'webkit'
      }
    },
    {
      name: 'figma',
      testDir: './tests/figma'
    }
  ],
  webServer: {
    command: `bun run dev -- --host 127.0.0.1 --port ${e2eAppPort} --strictPort`,
    port: e2eAppPort,
    reuseExistingServer: !isolatedE2EApp
  }
})
