import { expect, test } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'

for (const dpr of [1.25, 1.5, 2]) {
  test.describe(`retained device grid at DPR ${dpr}`, () => {
    test.use({ viewport: { width: 1110, height: 1000 }, deviceScaleFactor: dpr })

    test('settled fractional pans and tiny zoom changes match direct pixels', async ({ page }) => {
      await page.goto('/?test&no-chrome&no-rulers&navigation-benchmark')
      const canvas = new CanvasHelper(page)
      await canvas.waitForInit()
      await page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('Editor unavailable')
        for (const x of [40, 60.25, 80.5, 100.75]) {
          store.graph.createNode('RECTANGLE', store.state.currentPageId, {
            x,
            y: 40,
            width: 1,
            height: 80,
            fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
          })
        }
        store.graph.createNode('TEXT', store.state.currentPageId, {
          x: 130,
          y: 40,
          width: 160,
          height: 80,
          text: 'Crisp at rest\nFractional viewport',
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: 400,
          fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
        })
        store.requestRender()
      })
      const box = expectDefined(await canvas.canvas.boundingBox(), 'canvas bounds')
      const clip = { x: box.x + 20, y: box.y + 20, width: 300, height: 130 }
      for (const viewport of [
        { pan: 0.1, zoom: 1 },
        { pan: 0.3, zoom: 1 },
        { pan: 0.3, zoom: 1.00001 }
      ]) {
        await page.evaluate(({ pan, zoom }) => {
          const store = window.openPencil?.getStore?.()
          if (!store) throw new Error('Editor unavailable')
          store.setZoomAroundPoint(zoom, 0, 0)
          store.pan(pan - store.state.panX, pan - store.state.panY)
        }, viewport)
        await page.evaluate(() => window.openPencil?.test?.navigation?.waitForSettlement())
        const backingZoom = await page.evaluate(() => {
          const renderer = window.openPencil
            ?.getStore?.()
            .canvasRenderers.find((r) => r.tracksSceneSettlement)
          return renderer?.sceneBacking?.zoom
        })
        expect(backingZoom).toBe(viewport.zoom)
        const retained = await page.screenshot({ clip })
        const release = await page.evaluateHandle(() => {
          const store = window.openPencil?.getStore?.()
          if (!store) throw new Error('Editor unavailable')
          return store.beginInteractiveEdit()
        })
        try {
          await canvas.waitForRender()
          expect((await page.screenshot({ clip })).equals(retained)).toBe(true)
        } finally {
          await release.evaluate((stop) => stop())
          await release.dispose()
        }
        if (viewport.zoom !== 1) {
          expect(retained).toMatchSnapshot(`retained-grid-${dpr}.png`, {
            maxDiffPixelRatio: 0,
            threshold: 0
          })
        }
      }
      canvas.assertNoErrors()
    })
  })
}
