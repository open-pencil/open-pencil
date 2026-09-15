import { fileURLToPath } from 'node:url'

import type { Page } from '@playwright/test'

import { expect, test } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'

// This size exceeds the 3x overscan budget and previously produced fractional
// raster offsets, even though the live scene itself was pixel-aligned.
test.use({ viewport: { width: 1700, height: 1100 }, deviceScaleFactor: 2 })

async function createSelectedFrame(page: Page) {
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const id = store.createShape('FRAME', 100, 100, 320, 120)
    store.select([id])
  })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await createSelectedFrame(page)
})

test('settled HiDPI content is as sharp as the live drag rendering', async ({ page }) => {
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const id = [...store.state.selectedIds][0]
    if (!id) throw new Error('Expected selected frame')
    for (const x of [20, 40.25, 60.5, 80.75]) {
      store.graph.createNode('RECTANGLE', id, {
        x,
        y: 20,
        width: 1,
        height: 80,
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      })
    }
    store.graph.createNode('TEXT', id, {
      x: 110,
      y: 25,
      width: 190,
      height: 60,
      text: 'Crisp at rest\nAnd while editing',
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 400,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
  })
  const canvas = new CanvasHelper(page)
  await canvas.waitForRender()
  const box = expectDefined(await canvas.canvas.boundingBox(), 'canvas bounds')
  const clip = { x: box.x + 112, y: box.y + 112, width: 296, height: 96 }
  const settled = await page.screenshot({ clip })
  expect(settled).toMatchSnapshot('retained-hidpi-crisp.png')

  await page.mouse.move(box.x + 390, box.y + 200)
  await page.mouse.down()
  try {
    await page.mouse.move(box.x + 410, box.y + 200, { steps: 2 })
    await page.mouse.move(box.x + 390, box.y + 200, { steps: 2 })
    await canvas.waitForRender()
    const live = await page.screenshot({ clip })
    expect(live.equals(settled)).toBe(true)
  } finally {
    await page.mouse.up()
  }
})

for (const imported of [false, true]) {
  test(`paint pixels update live without rebuilding overscan (${imported ? 'imported design system' : 'blank document'})`, async ({
    page
  }) => {
    if (imported) {
      test.setTimeout(45_000)
      await page.route('**/__fixtures/gold-preview.fig', (route) =>
        route.fulfill({
          path: fileURLToPath(new URL('../../fixtures/gold-preview.fig', import.meta.url)),
          contentType: 'application/octet-stream'
        })
      )
      await page.evaluate(async () => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('Editor unavailable')
        const response = await fetch('/__fixtures/gold-preview.fig')
        await store.openFigFile(new File([await response.arrayBuffer()], 'gold-preview.fig'))
        store.setZoomAroundPoint(1, 0, 0)
        store.pan(-store.state.panX, -store.state.panY)
      })
      await createSelectedFrame(page)
    }
    // Recreate the surface in sRGB for platform-independent pixel expectations.
    await page.evaluate(() => window.openPencil?.getStore?.().setDocumentColorSpace('srgb'))
    await page.setViewportSize({ width: 1700, height: 1101 })
    const canvas = new CanvasHelper(page)
    await page.getByRole('button', { name: 'Fill', exact: true }).click()
    const area = page
      .getByRole('slider', { name: 'Saturation, Brightness', exact: true })
      .locator('..')
    const box = expectDefined(await area.boundingBox(), 'color area')
    await canvas.waitForRender()

    const trace = await page.evaluateHandle(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor unavailable')
      const renderer = [...store.canvasRenderers].find((r) => r.tracksSceneSettlement)
      if (!renderer) throw new Error('Scene renderer unavailable')
      const surface = renderer.surface
      const makeSurface = surface.makeSurface
      let overscanAllocations = 0
      surface.makeSurface = (info) => {
        if (
          info.width > renderer.viewportWidth * renderer.dpr ||
          info.height > renderer.viewportHeight * renderer.dpr
        ) {
          overscanAllocations++
        }
        return makeSurface.call(surface, info)
      }
      return {
        sample() {
          const id = [...store.state.selectedIds][0]
          const node = id ? store.graph.getNode(id) : undefined
          const color = node?.fills[0]?.color
          if (!color) throw new Error('Expected solid frame fill')
          return {
            expected: [color.r, color.g, color.b].map((channel) => Math.round(channel * 255)),
            batching: store.undo.isBatching,
            overscanAllocations
          }
        },
        restore() {
          surface.makeSurface = makeSurface
        }
      }
    })

    const canvasBox = expectDefined(await canvas.canvas.boundingBox(), 'canvas bounds')
    const pixelClip = { x: canvasBox.x + 180, y: canvasBox.y + 160, width: 1, height: 1 }
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.3)
    await page.mouse.down()
    try {
      const seen: number[][] = []
      for (const fraction of [0.4, 0.6, 0.8]) {
        await page.mouse.move(box.x + box.width * fraction, box.y + box.height * 0.4)
        await canvas.waitForRender()
        const screenshot = await page.screenshot({ clip: pixelClip, scale: 'css' })
        const pixel = await page.evaluate(
          async (bytes) => {
            const bitmap = await createImageBitmap(
              new Blob([Uint8Array.from(bytes)], { type: 'image/png' })
            )
            try {
              const context = new OffscreenCanvas(1, 1).getContext('2d')
              if (!context) throw new Error('Pixel decoder unavailable')
              context.drawImage(bitmap, 0, 0)
              return [...context.getImageData(0, 0, 1, 1).data]
            } finally {
              bitmap.close()
            }
          },
          [...screenshot]
        )
        const sample = await trace.evaluate((handle) => handle.sample())
        expect(sample.batching).toBe(true)
        expect(sample.overscanAllocations).toBe(0)
        for (let channel = 0; channel < 3; channel++) {
          expect(
            Math.abs(pixel[channel] - sample.expected[channel]),
            JSON.stringify({ pixel, ...sample })
          ).toBeLessThanOrEqual(1)
        }
        seen.push(pixel)
      }
      expect(seen[0]).not.toEqual(seen[1])
      expect(seen[1]).not.toEqual(seen[2])
    } finally {
      try {
        await page.mouse.up()
      } finally {
        try {
          await trace.evaluate((handle) => handle.restore())
        } finally {
          await trace.dispose()
        }
      }
    }
  })
}
