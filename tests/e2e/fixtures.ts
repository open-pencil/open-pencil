import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

export function useEditorSetup(url = '/') {
  let page: Page
  let canvas: CanvasHelper
  let context: Awaited<ReturnType<Page['context']>>

  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async () => {
    test.setTimeout(60_000)
  })

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(60_000)
    context = await browser.newContext()
    page = await context.newPage()
    await page.goto(url)
    canvas = new CanvasHelper(page)
    await canvas.waitForInit()
  })

  test.afterAll(async () => {
    if (page) await page.close()
    if (context) await context.close()
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
