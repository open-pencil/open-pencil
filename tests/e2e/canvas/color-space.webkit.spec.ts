import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import {
  dismissWideGamutBanner,
  emulateWideGamutDisplay,
  focusPaintEffects,
  sceneBufferState,
  waitForSettledScene,
  wideGamutBanner
} from '#tests/helpers/canvas/color-space'

test.use({ viewport: { width: 1200, height: 900 } })

test('P3 paint blends and masks survive pan, zoom, and surface resize', async ({ page }) => {
  await emulateWideGamutDisplay(page)
  await page.goto('/demo?no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await focusPaintEffects(page)
  // The notice appears once the document is Display P3, and dismissing it keeps the canvas
  // at a fixed offset for the snapshot.
  await dismissWideGamutBanner(page)
  await waitForSettledScene(page)

  async function expectEffects() {
    const buffer = await sceneBufferState(page)
    expect(buffer).toEqual({ colorSpace: 'srgb', documentColorSpace: 'display-p3', error: 0 })
    expect(await canvas.screenshotCanvas()).toMatchSnapshot('paint-effects.png')
    canvas.assertNoErrors()
  }
  await expectEffects()

  await canvas.canvas.hover()
  await page.mouse.wheel(80, 40)
  await page.keyboard.down('Control')
  try {
    await page.mouse.wheel(0, -120)
  } finally {
    await page.keyboard.up('Control')
  }
  await waitForSettledScene(page)
  expect((await sceneBufferState(page)).error).toBe(0)

  await page.setViewportSize({ width: 1320, height: 960 })
  await waitForSettledScene(page)
  expect((await sceneBufferState(page)).error).toBe(0)
  await page.setViewportSize({ width: 1200, height: 900 })
  await focusPaintEffects(page)
  await waitForSettledScene(page)
  await expectEffects()
})

test('warns when a Display-P3 document cannot be presented in wide gamut', async ({ page }) => {
  await page.goto('/demo?no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  // New documents are sRGB, so this notice only applies once a document declares Display P3.
  const banner = wideGamutBanner(page)
  await expect(banner).toBeHidden()
  expect(await sceneBufferState(page)).toMatchObject({
    colorSpace: 'srgb',
    documentColorSpace: 'srgb'
  })

  // This project renders through SwiftShader or WebKit, so wide gamut is unavailable and an
  // sRGB buffer is what a Display-P3 document gets.
  await page.evaluate(() => window.openPencil?.getStore?.()?.setDocumentColorSpace('display-p3'))
  await expect(banner).toBeVisible()
  await expect(banner).toContainText('Display-P3')

  await page.evaluate(() => window.openPencil?.getStore?.()?.setDocumentColorSpace('srgb'))
  await expect(banner).toBeHidden()
})
