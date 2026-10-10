import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

// The grid is redrawn on every frame of a pan or zoom. Drawn line by line as a path it cost about
// 8 ms of CPU per frame at 400% on a 1440 × 900 Retina viewport; as one shader draw it costs about
// 0.1 ms. This keeps it that way.
test.use({ deviceScaleFactor: 2, viewport: { width: 1440, height: 900 } })

test('the pixel grid adds no CPU time to panning frames', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/?test&no-chrome&no-rulers')
  await new CanvasHelper(page).waitForInit()
  const cost = await page.evaluate(async () => {
    const found = window.openPencil?.getStore?.()
    if (!found?.renderer) throw new Error('OpenPencil renderer not initialized')
    const store = found
    const profiler = found.renderer.profiler
    profiler.setVisible(true)
    const frame = () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
    // The densest grid: a line every 8 device pixels.
    store.state.zoom = 4
    async function averageFrameCpu(showPixelGrid: boolean) {
      store.state.showPixelGrid = showPixelGrid
      const samples: number[] = []
      for (let index = 0; index < 90; index++) {
        store.state.panX += 3.3
        store.state.panY += 1.7
        store.requestRepaint()
        await frame()
        if (index >= 30) samples.push(profiler.stats.cpuTime)
      }
      return samples.reduce((sum, sample) => sum + sample, 0) / samples.length
    }
    const without = await averageFrameCpu(false)
    const withGrid = await averageFrameCpu(true)
    profiler.setVisible(false)
    return { without, withGrid }
  })
  console.log(
    `Pan frame CPU at 400%: ${cost.without.toFixed(2)} ms without the grid, ${cost.withGrid.toFixed(2)} ms with it`
  )
  expect(cost.withGrid - cost.without).toBeLessThan(1)
})
