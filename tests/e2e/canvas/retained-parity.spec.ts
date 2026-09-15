import { writeFile } from 'node:fs/promises'

import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'

for (const dpr of [1, 1.25, 1.5, 2]) {
  test.describe(`retained raster parity at DPR ${dpr}`, () => {
    test.use({ viewport: { width: 1111, height: 999 }, deviceScaleFactor: dpr })
    test('rounded geometry matches direct rendering after odd and even device pans', async ({
      page
    }) => {
      await page.goto('/?test&no-chrome&no-rulers&navigation-benchmark')
      const canvas = new CanvasHelper(page)
      await canvas.waitForInit()
      await page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('Editor unavailable')
        const id = store.createShape('SECTION', 140, 140, 500, 350)
        store.updateNode(id, { rotation: 25 })
        store.clearSelection()
      })
      for (const devicePan of [0, 1, 2, -1, -2, 0.3]) {
        await page.evaluate(
          ({ devicePan, dpr }) => {
            const store = window.openPencil?.getStore?.()
            if (!store) throw new Error('Editor unavailable')
            store.pan(devicePan / dpr - store.state.panX, -devicePan / dpr - store.state.panY)
          },
          { devicePan, dpr }
        )
        await page.evaluate(() => window.openPencil?.test?.navigation?.waitForSettlement())
        await canvas.waitForRender()
        const retained = await canvas.screenshotCanvasRegion()
        const metadata = await page.evaluate(() => {
          const r = window.openPencil
            ?.getStore?.()
            .canvasRenderers.find((r) => r.tracksSceneSettlement)
          return {
            targetHeight: r?.surface.height(),
            backingHeight: r?.sceneBacking?.image.height(),
            marginY: r?.sceneBacking?.marginDeviceY,
            anchorX: r?.sceneBacking?.anchorPanX,
            anchorY: r?.sceneBacking?.anchorPanY,
            panX: r?.panX,
            panY: r?.panY
          }
        })
        const release = await page.evaluateHandle(() => {
          const store = window.openPencil?.getStore?.()
          if (!store) throw new Error('Editor unavailable')
          return store.beginInteractiveEdit()
        })
        try {
          await canvas.waitForRender()
          const direct = await canvas.screenshotCanvasRegion()
          if (!direct.equals(retained)) {
            await writeFile(test.info().outputPath('retained.png'), retained)
            await writeFile(test.info().outputPath('direct.png'), direct)
          }
          expect(direct.equals(retained), JSON.stringify({ dpr, devicePan, ...metadata })).toBe(
            true
          )
        } finally {
          await release.evaluate((stop) => stop())
          await release.dispose()
        }
      }
      canvas.assertNoErrors()
    })
  })
}
