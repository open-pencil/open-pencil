import type { Page } from '@playwright/test'

import { expect, test } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'

async function observeScenePixels(page: Page) {
  return page.evaluateHandle(() => {
    const store = window.openPencil?.getStore?.()
    const renderer = store?.canvasRenderers.find((r) => r.tracksSceneSettlement)
    const node = store?.getSelectedNodes()[0]
    const scene = document.querySelector<HTMLCanvasElement>('[data-test-id="scene-canvas-element"]')
    if (!store || !renderer || !node || !scene) throw new Error('Scene unavailable')
    const copy = document.createElement('canvas')
    copy.width = copy.height = 1
    const context = copy.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Readback unavailable')
    const surface = renderer.surface
    const flush = surface.flush
    const samples: { zoom: number; pixel: number[] }[] = []
    surface.flush = (...args) => {
      const result = flush.apply(surface, args)
      const position = store.graph.getAbsolutePosition(node.id)
      const x = Math.floor(
        (renderer.panX + (position.x + node.width / 2) * renderer.zoom) * renderer.dpr
      )
      const y = Math.floor(
        (renderer.panY + (position.y + node.height / 2) * renderer.zoom) * renderer.dpr
      )
      context.clearRect(0, 0, 1, 1)
      context.drawImage(scene, x, y, 1, 1, 0, 0, 1, 1)
      samples.push({
        zoom: renderer.zoom,
        pixel: Array.from(context.getImageData(0, 0, 1, 1).data)
      })
      return result
    }
    return {
      samples: () => samples,
      dispose() {
        surface.flush = flush
        copy.width = 0
      }
    }
  })
}

test.use({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 })

for (const renderer of ['retained', 'tiled'] as const) {
  test(`${renderer}: zoom fallback does not resurrect a picture from before creation`, async ({
    page
  }) => {
    await page.goto(`/?test&no-rulers&renderer=${renderer}&navigation-benchmark`)
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor unavailable')
      const node = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
        x: 300,
        y: 250,
        width: 220,
        height: 140,
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }]
      })
      store.select([node.id])
      store.requestRender()
    })
    await page.evaluate(() => window.openPencil?.test?.navigation?.waitForSettlement())
    const box = expectDefined(await canvas.canvas.boundingBox(), 'canvas bounds')
    const x = box.x + 300
    const y = box.y + 250
    await page.mouse.move(x + 110, y + 70)
    await page.keyboard.down('Control')
    try {
      // Leave backing coverage to record a whole-scene fallback, then return.
      await page.mouse.wheel(0, 240)
      await canvas.waitForRender()
      await page.mouse.wheel(0, -240)
    } finally {
      await page.keyboard.up('Control')
    }
    await page.evaluate(() => window.openPencil?.test?.navigation?.waitForSettlement())
    expect(
      await page.evaluate(() =>
        window.openPencil
          ?.getStore?.()
          .canvasRenderers.some((r) => r.tracksSceneSettlement && r.scenePicture !== null)
      )
    ).toBe(true)
    await page.keyboard.press('Backspace')
    await page.keyboard.press('r')
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 220, y + 140)
    const probe = await observeScenePixels(page)
    try {
      await page.mouse.up()
      await page.mouse.move(x + 110, y + 70)
      await page.keyboard.down('Control')
      for (const delta of [60, 60, 60, -180, 180, -180]) {
        await page.mouse.wheel(0, delta)
        await canvas.waitForRender()
      }
      await page.keyboard.up('Control')
      await page.evaluate(() => window.openPencil?.test?.navigation?.waitForSettlement())
      const samples = await probe.evaluate((p) => p.samples())
      expect(samples.length).toBeGreaterThan(4)
      expect(samples.some((sample) => sample.zoom < 0.3)).toBe(true)
      for (const sample of samples) {
        expect(sample.pixel, JSON.stringify(sample)).toEqual([212, 212, 212, 255])
      }
      await expect(page).toHaveScreenshot('fresh-scene-picture.png', {
        clip: { x: x - 20, y: y - 20, width: 260, height: 200 },
        maxDiffPixels: 0,
        threshold: 0
      })
      canvas.assertNoErrors()
    } finally {
      await page.keyboard.up('Control')
      await page.mouse.up()
      await probe.evaluate((p) => p.dispose())
      await probe.dispose()
    }
  })
}
