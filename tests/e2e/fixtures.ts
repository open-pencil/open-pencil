import { test, expect, type Locator, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

/**
 * `/` is the workspace; the editor lives at `/editor`.
 *
 * This default was `/` and was missed when the routes swapped, so every spec
 * calling `useEditorSetup()` with no argument navigated to the workspace and
 * then waited out its timeout on a canvas that was never going to appear.
 */
export function useEditorSetup(url = '/editor') {
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
