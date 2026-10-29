import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

for (const renderer of ['retained', 'tiled']) {
  test(`hiding and restoring the UI keeps ${renderer} content painted`, async ({ page }) => {
    await page.goto(`/?test&no-rulers&renderer=${renderer}`)
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    const handle = await page.getByTestId('left-splitter-handle').boundingBox()
    if (!handle) throw new Error('Splitter missing')
    await page.mouse.move(handle.x, handle.y + handle.height / 2)
    await page.mouse.down()
    await page.mouse.move(handle.x + 45, handle.y + handle.height / 2)
    await page.mouse.up()
    await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor unavailable')
      store.graph.createNode('RECTANGLE', store.state.currentPageId, {
        x: 60,
        y: 60,
        width: 140,
        height: 100,
        fills: [
          {
            type: 'SOLID',
            color: { r: 1, g: 0, b: 0, a: 1 },
            opacity: 1,
            visible: true,
            blendMode: 'NORMAL'
          }
        ]
      })
      store.zoomTo100()
      store.pan(-store.state.panX, -store.state.panY)
      store.requestRender()
    })
    await canvas.waitForRender()
    const artwork = async () => {
      const box = await page.getByTestId('canvas-area').boundingBox()
      if (!box) throw new Error('Canvas missing')
      return page.screenshot({ clip: { x: box.x + 80, y: box.y + 120, width: 90, height: 20 } })
    }
    const original = await artwork()
    const surfaces = await page.locator('canvas[data-ready="1"]').elementHandles()
    const layout = await page.getByTestId('canvas-area').boundingBox()
    for (let index = 0; index < 4; index++) {
      await page.keyboard.press('Meta+Backslash')
      for (const surface of surfaces) {
        expect(await surface.evaluate((element) => element.isConnected)).toBe(true)
      }
      await expect.poll(artwork).toEqual(original)
      canvas.assertNoErrors()
    }
    const restored = await page.getByTestId('canvas-area').boundingBox()
    expect(restored?.width).toBeCloseTo(layout?.width ?? 0, 0)
    expect(restored?.x).toBeCloseTo(layout?.x ?? 0, 0)
  })
}

test('hiding the UI keeps both split views mounted', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await page.getByRole('menuitem', { name: 'View', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Split right' }).click()
  const surfaces = page.locator('canvas[data-ready="1"]')
  await expect(surfaces).toHaveCount(4)
  const handles = await surfaces.elementHandles()
  await page.keyboard.press('Meta+Backslash')
  await expect(page.locator('[data-slot="canvas-pane-header"]')).toHaveCount(0)
  await expect(surfaces).toHaveCount(4)
  for (const surface of handles) {
    expect(await surface.evaluate((element) => element.isConnected)).toBe(true)
  }
  await page.keyboard.press('Meta+Backslash')
  await expect(page.locator('[data-slot="canvas-pane-header"]')).toHaveCount(2)
  canvas.assertNoErrors()
})
