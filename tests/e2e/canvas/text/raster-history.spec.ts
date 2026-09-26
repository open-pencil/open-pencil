import { writeFile } from 'node:fs/promises'

import type { Browser } from '@playwright/test'
import { toUint8Array } from 'js-base64'

import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'

async function captureText(
  browser: Browser,
  baseURL: string | undefined,
  gamut: 'srgb' | 'p3',
  backing: boolean
) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2
  })
  try {
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'color-gamut', value: gamut }]
    })
    await page.goto('/?test&no-chrome&no-rulers')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    await canvas.clearCanvas()
    const lease = await page.evaluateHandle(async (backing) => {
      const store = window.openPencil?.getStore?.()
      const renderer = store?.canvasRenderers.find((candidate) => candidate.tracksSceneSettlement)
      if (!store || !renderer) throw new Error('Scene renderer unavailable')
      const release = backing ? undefined : store.beginInteractiveEdit()
      const parent = store.state.currentPageId
      store.graph.createNode('FRAME', parent, {
        x: 64,
        y: 56,
        width: 660,
        height: 220,
        cornerRadius: 22,
        fills: [
          { type: 'SOLID', color: { r: 0.96, g: 0.97, b: 0.99, a: 1 }, visible: true, opacity: 1 }
        ]
      })
      store.graph.createNode('TEXT', parent, {
        name: 'Raster history subject',
        x: 96,
        y: 88,
        width: 560,
        height: 96,
        text: 'OPEN',
        fontFamily: 'Inter',
        fontSize: 88,
        fontWeight: 700,
        textAutoResize: 'NONE',
        fills: [
          {
            type: 'GRADIENT_LINEAR',
            visible: true,
            opacity: 1,
            gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
            gradientStops: [
              { position: 0, color: { r: 0.23, g: 0.51, b: 0.96, a: 1 } },
              { position: 1, color: { r: 0.58, g: 0.27, b: 0.95, a: 1 } }
            ]
          }
        ]
      })
      store.graph.createNode('TEXT', parent, {
        x: 100,
        y: 188,
        width: 520,
        height: 34,
        text: 'solid text remains paragraph-rendered',
        fontFamily: 'Inter',
        fontSize: 24,
        fontWeight: 500,
        textAutoResize: 'HEIGHT',
        fills: [
          { type: 'SOLID', color: { r: 0.08, g: 0.1, b: 0.18, a: 1 }, visible: true, opacity: 1 }
        ]
      })
      store.clearSelection()
      await store.loadFontsForNodes(store.graph.getPages().flatMap((page) => page.childIds))
      store.requestRender()
      return release
    }, backing)
    try {
      await canvas.waitForRender()
      await canvas.waitForRender()
      for (const solid of [false, true]) {
        await page.evaluate((solid) => {
          const store = window.openPencil?.getStore?.()
          const node = store?.graph
            .getAllNodes()
            .find((node) => node.name === 'Raster history subject')
          if (!store || !node) throw new Error('Text subject unavailable')
          store.updateNode(node.id, {
            fills: solid
              ? [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
              : node.fills.map((fill) => ({
                  ...fill,
                  gradientStops: fill.gradientStops?.map((stop) => ({
                    ...stop,
                    color: { r: 0, g: 0, b: 0, a: 1 }
                  }))
                }))
          })
        }, solid)
        await canvas.waitForRender()
        await canvas.waitForRender()
      }
      const result = await page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        const renderer = store?.canvasRenderers.find((candidate) => candidate.tracksSceneSettlement)
        const source = document.querySelector<HTMLCanvasElement>(
          '[data-test-id="scene-canvas-element"]'
        )
        const node = store?.graph
          .getAllNodes()
          .find((node) => node.name === 'Raster history subject')
        if (!store || !renderer || !source || !node) throw new Error('Scene unavailable')
        const paragraph = renderer.buildParagraph(node)
        let glyphs: number[]
        try {
          glyphs = paragraph
            .getShapedLines()
            .flatMap((line) => line.runs.flatMap((run) => Array.from(run.glyphs)))
        } finally {
          paragraph.delete()
        }
        const hadBacking = renderer.sceneBacking?.sceneVersion === store.state.sceneVersion
        const copy = document.createElement('canvas')
        copy.width = source.width
        copy.height = source.height
        const context = copy.getContext('2d', { colorSpace: 'srgb' })
        if (!context) throw new Error('Pixel capture unavailable')
        renderer.render(
          store.graph,
          new Set(),
          { editingTextId: '__text_history_no_node__' },
          store.state.sceneVersion,
          'scene'
        )
        context.drawImage(source, 0, 0)
        const data = context.getImageData(192, 176, 1120, 192).data
        let ink = 0
        for (let i = 0; i < data.length; i += 4) if (data[i] < 40 && data[i + 3] === 255) ink++
        return { png: copy.toDataURL(), glyphs, ink, hadBacking }
      })
      canvas.assertNoErrors()
      expect(result.glyphs).toHaveLength(4)
      expect(result.glyphs.every((glyph) => glyph > 0)).toBe(true)
      expect(result.ink).toBeGreaterThan(100)
      expect(result.hadBacking).toBe(backing)
      await cdp.detach()
      return Buffer.from(toUint8Array(result.png.split(',')[1]))
    } finally {
      await lease.evaluate((release) => release?.())
      await lease.dispose()
    }
  } finally {
    await context.close()
  }
}

for (const gamut of ['srgb', 'p3'] as const) {
  test(`solid text is independent of backing history in emulated ${gamut}`, async ({
    browser,
    baseURL,
    browserName
  }, testInfo) => {
    test.skip(browserName !== 'chromium', 'Color-gamut emulation requires Chromium CDP')
    const direct = await captureText(browser, baseURL, gamut, false)
    const retained = await captureText(browser, baseURL, gamut, true)
    const matches = retained.equals(direct)
    if (!matches) {
      await writeFile(testInfo.outputPath('direct-first.png'), direct)
      await writeFile(testInfo.outputPath('backing-first.png'), retained)
    }
    expect(matches).toBe(true)
  })
}
