import { writeFile } from 'node:fs/promises'

import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'
import { readScenePixels } from '#tests/helpers/canvas/pixels'

test('changing only the text paint preserves native glyph pixels', async ({ page }) => {
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  const id = await page.evaluate(() => {
    const store = window.lawha?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const black = { r: 0, g: 0, b: 0, a: 1 }
    const node = store.graph.createNode('TEXT', store.state.currentPageId, {
      x: 80,
      y: 80,
      width: 560,
      height: 96,
      text: 'OPEN',
      fontFamily: 'Inter',
      fontSize: 88,
      fontWeight: 400,
      textAutoResize: 'NONE',
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: black,
          opacity: 1,
          visible: true,
          gradientStops: [
            { position: 0, color: black },
            { position: 1, color: black }
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
        }
      ]
    })
    store.requestRender()
    return node.id
  })
  await canvas.waitForRender()
  const pixels = await readScenePixels(
    page,
    Array.from({ length: 8 }, (_, x) =>
      Array.from({ length: 6 }, (_, y) => ({ x: 90 + x * 30, y: 100 + y * 10 }))
    ).flat()
  )
  expect(pixels.some(([r, g, b, a]) => r < 32 && g < 32 && b < 32 && a === 255)).toBe(true)
  const gradient = await canvas.screenshotCanvasRegion()
  await page.evaluate((id) => {
    window.lawha?.getStore?.().updateNode(id, {
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
  }, id)
  await canvas.waitForRender()
  const solid = await canvas.screenshotCanvasRegion()
  if (!solid.equals(gradient)) {
    await writeFile(test.info().outputPath('gradient.png'), gradient)
    await writeFile(test.info().outputPath('solid.png'), solid)
  }
  expect(solid.equals(gradient)).toBe(true)
  canvas.assertNoErrors()
})
