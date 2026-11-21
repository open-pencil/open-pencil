import { test, expect, type Locator, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

export function useEditorSetup(url = '/?test') {
  let page: Page
  let canvas: CanvasHelper

  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    await page.goto(url)
    canvas = new CanvasHelper(page)
    await canvas.waitForInit()
  })

  test.afterAll(async () => {
    if (page) await page.close()
  })

  return {
    get page() {
      return page
    },
    get canvas() {
      return canvas
    },
    /** Reloads the shared page into a fresh editor that serial specs can reuse test after test. */
    async reload() {
      await page.reload()
      await canvas.waitForInit()
      await collectGarbage(page)
    }
  }
}

/**
 * Chromium keeps one renderer process across a page's reloads, and that process frees an earlier
 * load's WebAssembly memory and WebGL contexts only when it collects garbage. About fifteen
 * reloads in a row exhaust it and the page crashes, so the earlier loads are collected at once.
 */
async function collectGarbage(page: Page) {
  if (page.context().browser()?.browserType().name() !== 'chromium') return
  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('HeapProfiler.collectGarbage')
  } finally {
    await cdp.detach()
  }
}

export function useEditorSetupWithClear(url = '/?test') {
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
