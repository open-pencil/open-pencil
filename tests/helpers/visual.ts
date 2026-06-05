import { expect, type Page } from '@playwright/test'

import type { CanvasHelper } from '#tests/helpers/canvas'

export interface VisualReadyOptions {
  canvas?: CanvasHelper | null
}

export async function waitForVisualReady(page: Page, options: VisualReadyOptions = {}) {
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => document.fonts.ready)
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => new Promise(requestAnimationFrame))
  await page.evaluate(() => new Promise(requestAnimationFrame))
  if (options.canvas) {
    await options.canvas.waitForRender()
  }
}

export async function expectPageScreenshot(
  page: Page,
  name: string,
  options: VisualReadyOptions = {}
) {
  await waitForVisualReady(page, options)
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide'
  })
}
