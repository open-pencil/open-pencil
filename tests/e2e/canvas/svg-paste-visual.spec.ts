import { renderNodesToSVG } from '@open-pencil/core/io/formats/svg'
import { SceneGraph } from '@open-pencil/scene-graph'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

const CLIPPED_SVG = `<svg viewBox="0 0 200 120" width="200" height="120">
  <defs>
    <clipPath id="badge"><circle cx="60" cy="60" r="44"/><rect x="120" y="20" width="60" height="80" rx="12"/></clipPath>
  </defs>
  <g id="art" clip-path="url(#badge)">
    <rect width="200" height="60" fill="#4F46E5"/>
    <rect y="60" width="200" height="60" fill="#F59E0B"/>
  </g>
  <path d="M40 60l14 14 26-30" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
</svg>`

test('pasted SVG clip paths draw through their mask groups', async () => {
  const pasted = await editor.canvas.pasteSVG(CLIPPED_SVG, 220, 160)
  expect(pasted).toBe(true)
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('svg-clip-mask-groups.png')
})

// Figma 126 makes these layers 48×24, 44×24, and 35×24, the last centred on x = 100.
const TEXT_SVG = `<svg viewBox="0 0 200 130" width="200" height="130">
  <text x="10" y="30" font-family="Inter" font-size="20">Hello</text>
  <text x="10" y="70" font-family="Inter" font-size="20" font-weight="700" fill="#4F46E5">Bold</text>
  <text x="100" y="110" font-family="Inter" font-size="20" text-anchor="middle">Mid</text>
</svg>`

test('pasted SVG text measures and draws as Figma lays it out', async () => {
  await editor.canvas.pasteSVG(TEXT_SVG, 220, 160)
  const layers = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.graph.getAllNodes()]
      .filter((node) => node.type === 'TEXT')
      .map(({ text, x, width, height }) => ({ text, x, width, height }))
  })
  const expected = [
    { text: 'Hello', width: 48, height: 24 },
    { text: 'Bold', width: 44, height: 24 },
    { text: 'Mid', width: 35, height: 24 }
  ]
  expect(layers.map(({ text }) => text)).toEqual(expected.map(({ text }) => text))
  for (const [index, layer] of layers.entries()) {
    expect(Math.abs(layer.width - expected[index].width)).toBeLessThanOrEqual(2)
    expect(layer.height).toBe(expected[index].height)
  }
  const mid = layers[2]
  expect(mid.x + mid.width / 2).toBeCloseTo(100, 0)
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('svg-text-layers.png')
})

function exportedStyledText(): string {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const node = graph.createNode('TEXT', pageId, {
    width: 200,
    height: 60,
    text: 'Hello bold world',
    fontFamily: 'Inter',
    fontSize: 24,
    styleRuns: [{ start: 6, length: 4, style: { fontWeight: 700 } }]
  })
  const svg = renderNodesToSVG(graph, pageId, [node.id], { xmlDeclaration: false })
  if (!svg) throw new Error('nothing exported')
  return svg
}

test('exported SVG text keeps characters outside the style run', async () => {
  const pasted = await editor.canvas.pasteSVG(exportedStyledText(), 220, 160)
  expect(pasted).toBe(true)
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('svg-export-style-runs.png')
})

function exportedSVGWithSkippedBackdropBlur(): string {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const background = graph.createNode('RECTANGLE', pageId, {
    width: 200,
    height: 120,
    fills: [
      { type: 'SOLID', color: { r: 0.29, g: 0.12, b: 0.65, a: 1 }, opacity: 1, visible: true }
    ]
  })
  const left = graph.createNode('RECTANGLE', pageId, {
    x: 0,
    width: 54,
    height: 120,
    fills: [
      { type: 'SOLID', color: { r: 0.98, g: 0.62, b: 0.18, a: 1 }, opacity: 1, visible: true }
    ]
  })
  const right = graph.createNode('RECTANGLE', pageId, {
    x: 146,
    width: 54,
    height: 120,
    fills: [
      { type: 'SOLID', color: { r: 0.16, g: 0.72, b: 0.67, a: 1 }, opacity: 1, visible: true }
    ]
  })
  const panel = graph.createNode('RECTANGLE', pageId, {
    x: 48,
    y: 24,
    width: 104,
    height: 72,
    opacity: 0.72,
    cornerRadius: 12,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
    effects: [
      {
        type: 'BACKGROUND_BLUR',
        radius: 12,
        visible: true,
        color: { r: 0, g: 0, b: 0, a: 0 },
        offset: { x: 0, y: 0 },
        spread: 0
      }
    ]
  })
  const svg = renderNodesToSVG(graph, pageId, [background.id, left.id, right.id, panel.id], {
    skipUnsupportedEffects: true,
    xmlDeclaration: false
  })
  if (!svg) throw new Error('nothing exported')
  return svg
}

test('exported SVG can be pasted when unsupported backdrop blur is omitted', async () => {
  const pasted = await editor.canvas.pasteSVG(exportedSVGWithSkippedBackdropBlur(), 220, 160)
  expect(pasted).toBe(true)
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  const canvasBounds = await editor.canvas.canvas.boundingBox()
  if (!canvasBounds) throw new Error('Canvas has no bounding box')
  const screenshot = await editor.page.screenshot({
    clip: {
      x: canvasBounds.x + 110,
      y: canvasBounds.y + 100,
      width: 220,
      height: 144
    }
  })
  expect(screenshot).toMatchSnapshot('svg-skipped-backdrop-blur.png')
})
