import { readFileSync } from 'node:fs'

import type { SceneNode } from '@open-pencil/scene-graph'

import { expect, test } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'
import { mockFontsource } from '#tests/helpers/fonts/fontsource'

test.use({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })

test('reused Unicode section labels match fresh paragraphs across zoom reversals', async ({
  page
}) => {
  const fonts = await mockFontsource(page, [
    {
      family: 'Noto Naskh Arabic',
      subset: 'arabic',
      data: readFileSync('public/NotoNaskhArabic-Regular.ttf')
    },
    {
      family: 'Noto Sans SC',
      subset: 'chinese-simplified',
      data: readFileSync('tests/fixtures/fonts/NotoSansCJK-Test.otf'),
      format: 'otf'
    }
  ])
  try {
    await page.goto('/?test&no-rulers&navigation-benchmark')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor unavailable')
      const names = [
        'Button',
        'AV To ffi',
        'Привет',
        'Ελληνικά',
        'écho café',
        'مرحبا',
        '你好',
        'Trail   ',
        'one\ntwo'
      ]
      for (const [index, name] of names.entries()) {
        store.graph.createNode('SECTION', store.state.currentPageId, {
          name,
          x: 80,
          y: 70 + index * 70,
          width: 130,
          height: 40,
          fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
          strokes: [
            {
              color: { r: 0.7, g: 0.7, b: 0.7, a: 1 },
              weight: 1,
              opacity: 1,
              visible: true,
              align: 'INSIDE'
            }
          ]
        })
      }
      store.clearSelection()
      store.requestRender()
    })
    await expect
      .poll(() =>
        page.evaluate(() => {
          const renderer = window.openPencil
            ?.getStore?.()
            .canvasRenderers.find((r) => r.fontsLoaded && r.fontProvider)
          const provider = renderer?.fontProvider
          if (!renderer || !provider) return false
          return ['مرحبا', '你好'].every((text) =>
            renderer.labelParagraphCache.use(
              renderer.ck,
              provider,
              text,
              11,
              300,
              renderer.ck.BLACK,
              renderer.fontGeneration,
              ({ paragraph }) => {
                const runs = paragraph.getShapedLines().flatMap((line) => line.runs)
                return (
                  runs.length > 0 &&
                  runs.every(
                    (run) => run.glyphs.length > 0 && run.glyphs.every((glyph) => glyph !== 0)
                  )
                )
              },
              600
            )
          )
        })
      )
      .toBe(true)
    expect(fonts.counts.downloads).toBeGreaterThanOrEqual(2)
    await canvas.waitForRender()
    for (const zoom of [1.25, 0.6, 1.1, 0.75, 1]) {
      await page.evaluate((scale) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('Editor unavailable')
        store.setZoomAroundPoint(scale, 0, 0)
      }, zoom)
      await page.evaluate(() => window.openPencil?.test?.navigation?.waitForSettlement())
      await canvas.waitForRender()
      const reused = await canvas.screenshotCanvasRegion(520, 840)
      await page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store?.canvasRenderers.length) throw new Error('Renderer unavailable')
        for (const renderer of store.canvasRenderers) renderer.labelParagraphCache.clear()
        store.requestRepaint()
      })
      await canvas.waitForRender()
      const fresh = await canvas.screenshotCanvasRegion(520, 840)
      expect(reused.equals(fresh), `label pixels at ${zoom} zoom`).toBe(true)
      if (zoom === 1)
        expect(fresh).toMatchSnapshot('unicode-section-labels.png', {
          threshold: 0,
          maxDiffPixels: 0
        })
    }
    canvas.assertNoErrors()
  } finally {
    await fonts.dispose()
  }
})

for (const rotation of [-145, -40, 50]) {
  test(`frame titles and dimensions remain readable at ${rotation} degrees`, async ({ page }) => {
    await page.goto('/?test&no-rulers')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    await page.evaluate((angle) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor unavailable')
      const id = store.createShape('FRAME', 250, 250, 300, 180)
      store.updateNode(id, { name: 'Frame', rotation: angle })
      store.select([id])
    }, rotation)
    const box = expectDefined(await canvas.canvas.boundingBox(), 'canvas bounds')
    await expect(page).toHaveScreenshot(`readable-frame-${rotation}.png`, {
      clip: { x: box.x + 150, y: box.y + 100, width: 500, height: 500 },
      maxDiffPixels: 0,
      threshold: 0,
      scale: 'device'
    })
    canvas.assertNoErrors()
  })
}

for (const zoom of [0.5, 1, 2]) {
  test(`section pills retain their size and hover target at ${zoom} zoom`, async ({ page }) => {
    await page.goto('/?test&no-rulers')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    const lightId = await page.evaluate((scale) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor unavailable')
      const sectionPaint = {
        fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
        strokes: [
          {
            color: { r: 0.7, g: 0.7, b: 0.7, a: 1 },
            weight: 1,
            opacity: 1,
            visible: true,
            align: 'INSIDE'
          }
        ]
      } satisfies Pick<SceneNode, 'fills' | 'strokes'>
      const color = store.graph.createNode('SECTION', store.state.currentPageId, {
        name: 'Color',
        x: 60,
        y: 100,
        width: 280,
        height: 150,
        ...structuredClone(sectionPaint)
      })
      const light = store.graph.createNode('SECTION', color.id, {
        name: 'Light',
        x: 16,
        y: 30,
        width: 248,
        height: 100,
        ...structuredClone(sectionPaint)
      })
      store.graph.createNode('RECTANGLE', light.id, {
        x: 20,
        y: 60,
        width: 60,
        height: 24,
        fills: [
          { type: 'SOLID', color: { r: 0.05, g: 0.05, b: 0.05, a: 1 }, opacity: 1, visible: true }
        ]
      })
      store.clearSelection()
      store.setZoomAroundPoint(scale, 0, 0)
      store.requestRender()
      return light.id
    }, zoom)
    const box = expectDefined(await canvas.canvas.boundingBox(), 'canvas bounds')
    const clip = { x: box.x + 10, y: box.y + 10, width: 700, height: 560 }
    await expect(page).toHaveScreenshot(`section-pills-${zoom}.png`, {
      clip,
      maxDiffPixels: 0,
      threshold: 0,
      scale: 'device'
    })
    // Nested titles have a fixed six-pixel inset and a screen-sized pill.
    await page.mouse.move(box.x + 76 * zoom + 18, box.y + 130 * zoom + 18)
    await expect
      .poll(() => page.evaluate(() => window.openPencil?.getStore?.().state.hoveredNodeId))
      .toBe(lightId)
    await expect(page).toHaveScreenshot(`section-pills-hover-${zoom}.png`, {
      clip,
      maxDiffPixels: 0,
      threshold: 0,
      scale: 'device'
    })
    canvas.assertNoErrors()
  })
}
