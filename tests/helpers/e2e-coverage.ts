import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { Page, TestInfo } from '@playwright/test'

type PlaywrightTest = typeof import('@playwright/test').test

const ENABLE_E2E_COVERAGE = process.env.INKLY_E2E_COVERAGE === '1'
const OUT_DIR = resolve(process.cwd(), '.context/coverage/e2e/raw')

function slugify(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function outputPath(testInfo: TestInfo, suite: string) {
  const name = slugify(`${testInfo.file}__${testInfo.title}`)
  return resolve(OUT_DIR, `${suite}__${name}.json`)
}

async function startCoverage(page: Page) {
  await page.coverage.startJSCoverage({
    reportAnonymousScripts: false,
    resetOnNavigation: false
  })
}

async function stopCoverage(page: Page, testInfo: TestInfo, suite: string) {
  const coverage = await page.coverage.stopJSCoverage()
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(
    outputPath(testInfo, suite),
    JSON.stringify(
      {
        suite,
        project: testInfo.project.name,
        file: testInfo.file,
        title: testInfo.title,
        status: testInfo.status,
        duration: testInfo.duration,
        coverage
      },
      null,
      2
    )
  )
}

export function useE2ECoverage(playwrightTest: PlaywrightTest, suite: string) {
  if (!ENABLE_E2E_COVERAGE) return

  playwrightTest.beforeEach(async ({ page }) => {
    await startCoverage(page)
  })

  playwrightTest.afterEach(async ({ page }, testInfo) => {
    await stopCoverage(page, testInfo, suite)
  })
}
