import { defineConfig } from '@playwright/test'

const appPort = process.env.OPENPENCIL_TEST_PORT ?? '1420'
const mcpPort = process.env.OPENPENCIL_TEST_MCP_PORT ?? '7600'
for (const port of [appPort, mcpPort]) {
  if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) {
    throw new Error('Browser test ports must be integers between 1024 and 65535')
  }
}
if (Number(appPort) === Number(mcpPort)) throw new Error('App and MCP test ports must differ')
const origin = `http://localhost:${appPort}`
const reuse = process.env.OPENPENCIL_TEST_REUSE_SERVER
if (reuse !== undefined && reuse !== '0' && reuse !== '1') {
  throw new Error('OPENPENCIL_TEST_REUSE_SERVER must be 0 or 1')
}

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
    baseURL: origin,
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
      testIgnore: '**/native/**',
      fullyParallel: false
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
    command: `bun run dev --port ${appPort} --strictPort`,
    cwd: import.meta.dirname,
    url: origin,
    env: {
      OPENPENCIL_DEV_ORIGIN: origin,
      OPENPENCIL_DEV_MCP_PORT: mcpPort,
      PORTLESS_URL: ''
    },
    reuseExistingServer: !process.env.CI && reuse === '1'
  }
})
