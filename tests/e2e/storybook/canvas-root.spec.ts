import { expect, test } from '@playwright/test'

test('CanvasRoot starts CanvasKit for the CanvasSurface inside it', async ({ page }) => {
  await page.goto('/iframe.html?id=vue-sdk-canvas-canvas-root--default&viewMode=story')
  const canvas = page.locator('canvas')
  await expect(canvas).toHaveAttribute('data-ready', 'true')
  // A canvas keeps its 300×150 default until CanvasKit creates a surface at its CSS size.
  expect(await canvas.evaluate((element: HTMLCanvasElement) => element.width)).toBe(600)
})
