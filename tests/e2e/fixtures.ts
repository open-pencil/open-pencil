import { test, expect, type Locator, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

/**
 * Module-level cache for external API responses, shared across all test files.
 * The app fetches font metadata from Google Fonts and icons from Iconify at
 * runtime. Without caching, every new browser page triggers fresh API requests,
 * which causes 429 (Too Many Requests) errors during test runs. This cache
 * ensures each unique URL is fetched at most once; subsequent requests are
 * served from memory, eliminating rate-limit failures.
 */
const externalApiCache = new Map<string, { status: number; body: Buffer; contentType: string }>()

const EXTERNAL_API_PATTERNS = ['https://www.googleapis.com/**', 'https://api.iconify.design/**']

/** Set up route handlers that cache external API responses on the page. */
async function setupExternalApiCache(page: Page): Promise<void> {
  for (const pattern of EXTERNAL_API_PATTERNS) {
    await page.route(pattern, async (route) => {
      const url = route.request().url()
      const cached = externalApiCache.get(url)
      if (cached) {
        await route.fulfill({
          status: cached.status,
          body: cached.body,
          contentType: cached.contentType
        })
        return
      }
      const response = await route.fetch()
      const body = Buffer.from(await response.body())
      const contentType = response.headers()['content-type'] ?? 'application/json'
      if (response.ok()) {
        externalApiCache.set(url, { status: response.status(), body, contentType })
      }
      await route.fulfill({ status: response.status(), body, contentType })
    })
  }
}

export function useEditorSetup(url = '/') {
  let page: Page
  let canvas: CanvasHelper

  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    await setupExternalApiCache(page)
    await page.goto(url)
    canvas = new CanvasHelper(page)
    await canvas.waitForInit()
  })

  test.afterAll(async () => {
    if (page) {
      await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => undefined)
      await page.close()
    }
  })

  return {
    get page() {
      return page
    },
    get canvas() {
      return canvas
    }
  }
}

export function useEditorSetupWithClear(url = '/') {
  const ctx = useEditorSetup(url)

  test.beforeEach(async () => {
    await ctx.canvas.clearCanvas()
  })

  return ctx
}

export async function expectInViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Expected visible element to have a bounding box')

  const viewport = page.viewportSize()
  if (!viewport) throw new Error('Expected page to have a viewport')

  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
}

export { test, expect }
