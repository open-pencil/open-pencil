import { expect, test } from '@playwright/test'

test.describe('browser support gate', () => {
  test('explains a missing baseline feature instead of booting into a blank window', async ({
    page
  }) => {
    await page.addInitScript(() => {
      // Playwright's Chromium is above the baseline, so remove one sentinel
      // feature to simulate an engine that cannot run the app.
      Reflect.deleteProperty(String.prototype, 'isWellFormed')
    })
    await page.goto('/')

    const notice = page.getByRole('alert')
    await expect(notice.getByRole('heading', { level: 1 })).toHaveText(
      'A required browser feature is unavailable'
    )
    await expect(notice).toContainText('String.prototype.isWellFormed')
    await expect(notice.getByRole('link', { name: 'System requirements' })).toHaveAttribute(
      'href',
      'https://openpencil.dev/getting-started#system-requirements'
    )

    const report = notice.getByRole('link', { name: 'Report a problem' })
    const href = new URL((await report.getAttribute('href')) ?? '')
    expect(href.pathname).toBe('/open-pencil/open-pencil/issues/new')
    expect(href.searchParams.get('template')).toBe('bug_report.yml')
    expect(href.searchParams.get('platform')).toBe('Web (app.openpencil.dev)')
    expect(href.searchParams.get('logs')).toContain('Missing: String.prototype.isWellFormed')

    await notice.getByText('Details', { exact: true }).click()
    await expect(notice.locator('pre')).toContainText('User agent:')
    await expect(page.locator('canvas')).toHaveCount(0)
  })

  test('replaces a blank window with a boot failure notice when the app cannot load', async ({
    page
  }) => {
    await page.addInitScript(() => {
      // Keep every sentinel intact but break an API the app needs while
      // booting, so the failure surfaces after the gate has passed.
      Object.defineProperty(window, 'history', {
        configurable: true,
        get() {
          throw new TypeError('history is unavailable')
        }
      })
    })
    await page.goto('/')

    const notice = page.getByRole('alert')
    await expect(notice.getByRole('heading', { level: 1 })).toHaveText("OpenPencil couldn't start")
    await expect(notice).toContainText('Chrome 111')
    await notice.getByText('Details', { exact: true }).click()
    await expect(notice.locator('pre')).toContainText('history is unavailable')
  })

  test('reports a component that fails while rendering the first route', async ({ page }) => {
    await page.addInitScript(() => {
      // The editor store mints node ids inside component setup, so this
      // fails through Vue's error handler rather than module evaluation.
      Object.defineProperty(crypto, 'getRandomValues', {
        configurable: true,
        value() {
          throw new TypeError('getRandomValues is unavailable')
        }
      })
    })
    await page.goto('/')

    const notice = page.getByRole('alert')
    await expect(notice.getByRole('heading', { level: 1 })).toHaveText("OpenPencil couldn't start")
    await notice.getByText('Details', { exact: true }).click()
    await expect(notice.locator('pre')).toContainText('getRandomValues is unavailable')
  })
})
