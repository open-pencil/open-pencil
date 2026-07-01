import { fileURLToPath } from 'node:url'

import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

const TEST_CJK_FONT_URL = 'http://localhost:1420/__test-fonts/NotoSansSC-Regular.ttf'
const TEST_CJK_FONT_PATH = fileURLToPath(
  new URL('../../fixtures/fonts/NotoSansSC-Regular.ttf', import.meta.url)
)

type GlyphSignature = {
  bounds: { maxX: number; maxY: number; minX: number; minY: number }
  char: string
  darkPixels: number
  signature: number[]
}

async function stubGoogleFonts(page: Page) {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      let url: string
      if (typeof input === 'string') url = input
      else if (input instanceof URL) url = input.href
      else url = input.url
      if (url.startsWith('https://www.googleapis.com/webfonts/v1/webfonts')) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }
      return originalFetch(input, init)
    }
  })
}

function signatureDistance(a: number[], b: number[]) {
  let distance = 0
  for (let i = 0; i < a.length; i++) distance += Math.abs(a[i] - b[i])
  return distance
}

test('CJK glyphs render distinctly while rerendering moving text', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await stubGoogleFonts(page)
  await page.route(TEST_CJK_FONT_URL, async (route) => {
    await route.fulfill({
      path: TEST_CJK_FONT_PATH,
      contentType: 'font/ttf'
    })
  })
  await page.goto('http://localhost:1420/?test&no-chrome&no-rulers')
  await canvas.waitForInit()

  const glyphs = await page.evaluate(async (fontUrl): Promise<GlyphSignature[]> => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const renderer = store.renderer
    if (!renderer) throw new Error('OpenPencil renderer not initialized')

    const fontsModuleUrl =
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((name) => name.includes('/packages/core/src/text/fonts.ts')) ??
      '/packages/core/src/text/fonts.ts'
    const { fontManager } = await import(/* @vite-ignore */ fontsModuleUrl)
    const [interData, cjkData] = await Promise.all([
      fetch('/Inter-Regular.ttf').then((response) => response.arrayBuffer()),
      fetch(fontUrl).then((response) => response.arrayBuffer())
    ])
    fontManager.markLoaded('Inter', 'Regular', interData)
    fontManager.markLoaded('Noto Sans SC', 'Regular', cjkData)
    fontManager.setCJKFallbackFamily('Noto Sans SC')

    const pageNode = store.graph.getNode(store.state.currentPageId)
    if (!pageNode) throw new Error('Current page not found')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0

    const chars = ['你', '好', '世', '界'] as const
    const boxes = chars.map((char, index) => ({
      char,
      height: 86,
      width: 86,
      x: 80 + index * 100,
      y: 80
    }))
    const nodeIds = boxes.map((box) =>
      store.graph.createNode('TEXT', pageNode.id, {
        name: `CJK glyph ${box.char}`,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        text: box.char,
        fontFamily: 'Inter',
        fontSize: 64,
        fontWeight: 400,
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
      })
    )

    for (let step = 0; step < 40; step++) {
      const dx = step % 2
      const dy = step % 3
      for (let index = 0; index < nodeIds.length; index++) {
        const box = boxes[index]
        store.graph.updateNode(nodeIds[index], { x: box.x + dx, y: box.y + dy })
      }
      renderer.renderFromEditorState(
        store.state,
        store.graph,
        store.textEditor,
        800,
        600,
        false,
        'full'
      )
    }

    await new Promise(requestAnimationFrame)

    const sources = [
      document.querySelector<HTMLCanvasElement>('[data-test-id="scene-canvas-element"]'),
      document.querySelector<HTMLCanvasElement>('[data-test-id="canvas-element"]')
    ].filter((canvas): canvas is HTMLCanvasElement => canvas !== null)
    if (sources.length === 0) throw new Error('Canvas elements not found')
    const source = sources[0]
    const rect = source.getBoundingClientRect()
    const scaleX = source.width / rect.width
    const scaleY = source.height / rect.height
    const offscreen = document.createElement('canvas')
    offscreen.width = source.width
    offscreen.height = source.height
    const ctx = offscreen.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Could not create 2D canvas context')
    for (const canvas of sources) ctx.drawImage(canvas, 0, 0, source.width, source.height)

    const finalDx = 39 % 2
    const finalDy = 39 % 3
    const gridSize = 12
    return boxes.map((box) => {
      const x = Math.round((box.x + finalDx) * scaleX)
      const y = Math.round((box.y + finalDy) * scaleY)
      const width = Math.round(box.width * scaleX)
      const height = Math.round(box.height * scaleY)
      const data = ctx.getImageData(x, y, width, height).data
      const bins = Array.from({ length: gridSize * gridSize }, () => 0)
      let darkPixels = 0
      let minX = width
      let minY = height
      let maxX = -1
      let maxY = -1

      for (let offset = 0; offset < data.length; offset += 4) {
        const alpha = data[offset + 3]
        const gray = (data[offset] + data[offset + 1] + data[offset + 2]) / 3
        const darkness = alpha > 0 ? 255 - gray : 0
        if (darkness <= 48) continue

        const pixel = offset / 4
        const px = pixel % width
        const py = Math.floor(pixel / width)
        const gx = Math.min(gridSize - 1, Math.floor((px / width) * gridSize))
        const gy = Math.min(gridSize - 1, Math.floor((py / height) * gridSize))
        bins[gy * gridSize + gx] += darkness
        darkPixels++
        minX = Math.min(minX, px)
        minY = Math.min(minY, py)
        maxX = Math.max(maxX, px)
        maxY = Math.max(maxY, py)
      }

      return {
        bounds: { maxX, maxY, minX, minY },
        char: box.char,
        darkPixels,
        signature: bins.map((value) => Math.round(value / Math.max(1, darkPixels)))
      }
    })
  }, TEST_CJK_FONT_URL)

  expect(glyphs.map((glyph) => glyph.char)).toEqual(['你', '好', '世', '界'])
  for (const glyph of glyphs) {
    expect(glyph.darkPixels).toBeGreaterThan(400)
    expect(glyph.bounds.maxX - glyph.bounds.minX).toBeGreaterThan(20)
    expect(glyph.bounds.maxY - glyph.bounds.minY).toBeGreaterThan(20)
  }

  const distances: number[] = []
  for (let i = 0; i < glyphs.length; i++) {
    for (let j = i + 1; j < glyphs.length; j++) {
      distances.push(signatureDistance(glyphs[i].signature, glyphs[j].signature))
    }
  }

  expect(Math.min(...distances)).toBeGreaterThan(120)
  canvas.assertNoErrors()
})
