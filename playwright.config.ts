import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 15_000,
  workers: 1,
  expect: {
    toHaveScreenshot: {
      pathTemplate: '{testDir}/visual/__snapshots__/{arg}{ext}',
      maxDiffPixelRatio: 0.01,
      threshold: 0.3
    },
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.01,
      threshold: 0.3
    }
  },
  use: {
    baseURL: 'http://localhost:1420',
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
      name: 'inkly',
      testDir: './tests/e2e',
      fullyParallel: false
    },
    {
      name: 'inkly-webkit',
      testDir: './tests/e2e',
      testMatch: '**/*.webkit.spec.ts',
      use: {
        browserName: 'webkit'
      }
    },
    {
      name: 'figma',
      testDir: './tests/figma'
    }
  ],
  webServer: [
    {
      command: 'VITE_INKLY_AUTH_TEST_MODE=1 bun run dev',
      port: 1420,
      reuseExistingServer: true
    },
    {
      command:
        'INKLY_API_DB_MODE=memory INKLY_API_JWT_SECRET=playwright-secret INKLY_API_AUTH_ENABLE_TEST_UTILS=1 bun --filter @inkly/api dev',
      port: 3001,
      reuseExistingServer: true
    }
  ]
})
