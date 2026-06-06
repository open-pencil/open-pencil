import { expect, type Locator, type Page } from '@playwright/test'

function toResponseMatcher(urlPattern: RegExp | string) {
  return (url: string) =>
    typeof urlPattern === 'string' ? url.includes(urlPattern) : urlPattern.test(url)
}

export async function expectToast(
  page: Page,
  message: string,
  options: { timeout?: number } = {}
) {
  const toast = page.getByTestId('toast').filter({ hasText: message }).first()
  await expect(toast).toBeVisible({ timeout: options.timeout })
  await expect(toast).toContainText(message)
}

export async function expectModal(
  page: Page,
  testId: string,
  options: { open: boolean }
) {
  const modal = page.getByTestId(testId)
  if (options.open) {
    await expect(modal).toBeVisible()
    return
  }

  await expect(modal).toHaveCount(0)
}

export async function expectClipboard(page: Page, expected: string) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  const value = await page.evaluate(() => navigator.clipboard.readText())
  expect(value).toBe(expected)
}

export interface ClickAndWaitForResponseOptions {
  /** HTTP method filter. Pass an array for multiple methods. Default: any. */
  method?: string | string[]
  /** Require response.ok() to be true. Default: true. */
  ok?: boolean
  /** waitForResponse timeout in ms. */
  timeout?: number
}

/**
 * Click a target after the response listener is already armed.
 *
 * The listener is registered via `page.waitForResponse(...)` before the click
 * fires. This avoids the race where a `Promise.all([waitForResponse, click])`
 * shape lets the click trigger a fetch that resolves before the matcher is
 * actually subscribed (observed when click navigates the page, e.g. board
 * create flow in dashboard.interaction).
 *
 * The matcher also defaults to `method=any` + `ok=true`, and accepts an
 * explicit `method` filter so callers can scope to e.g. `POST` only.
 */
export async function clickAndWaitForResponse<T>(
  page: Page,
  locator: Locator,
  urlPattern: RegExp | string,
  options: ClickAndWaitForResponseOptions = {}
) {
  const { method, ok = true, timeout } = options
  const matches = toResponseMatcher(urlPattern)
  const methods = Array.isArray(method)
    ? method.map((m) => m.toUpperCase())
    : typeof method === 'string'
      ? [method.toUpperCase()]
      : null

  const responsePromise = page.waitForResponse(
    (candidate) => {
      if (!matches(candidate.url())) return false
      if (ok && !candidate.ok()) return false
      if (methods && !methods.includes(candidate.request().method().toUpperCase())) return false
      return true
    },
    timeout === undefined ? undefined : { timeout }
  )
  await locator.click()
  const response = await responsePromise
  return (await response.json()) as T
}

export async function expectHoverStyle(
  locator: Locator,
  expected: {
    backgroundColor?: string
    color?: string
  }
) {
  await locator.hover()
  const styles = await locator.evaluate((element) => {
    const computed = window.getComputedStyle(element)
    return {
      backgroundColor: computed.backgroundColor,
      color: computed.color
    }
  })

  if (expected.backgroundColor) {
    expect(styles.backgroundColor).toBe(expected.backgroundColor)
  }
  if (expected.color) {
    expect(styles.color).toBe(expected.color)
  }
}
