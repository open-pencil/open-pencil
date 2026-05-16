import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

export function useEditorSetup(url = '/') {
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
    await page.close()
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

export { test, expect }
