import { expect, test } from '@playwright/test'

test('the canvas story starts CanvasKit and sizes its surface', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/iframe.html?id=vue-sdk-canvas-presence-cursors--room&viewMode=story')
  const canvas = page.locator('canvas')
  // A canvas keeps its 300×150 default until CanvasKit creates a surface at its CSS size.
  await expect
    .poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.width))
    .toBeGreaterThan(300)
  expect(errors).toEqual([])
})
