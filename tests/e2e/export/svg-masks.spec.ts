import { expect, test, type Page } from '@playwright/test'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { createSVGNodes, renderNodesToSVG } from '@open-pencil/core/io/formats/svg'
import { SceneGraph, type Fill } from '@open-pencil/scene-graph'
import { svgDataURL } from '@open-pencil/scene-graph/images'

function solid(r: number, g: number, b: number, opacity = 1): Fill {
  return { type: 'SOLID', color: { r, g, b, a: 1 }, opacity, visible: true }
}

const WHITE = solid(1, 1, 1)
const RED = solid(1, 0, 0)

/** The SVG the layers `build` makes on a fresh page export to. */
function exportedSVG(build: (graph: SceneGraph, pageId: string) => string[]): string {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const svg = renderNodesToSVG(graph, pageId, build(graph, pageId), { xmlDeclaration: false })
  if (!svg) throw new Error('nothing exported')
  return svg
}

/** The RGB the browser draws `svg` with at each point, on white. */
async function pixels(page: Page, svg: string, points: [number, number][]): Promise<number[][]> {
  return page.evaluate(
    async ({ url, points }) => {
      const image = new Image()
      image.src = url
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('no 2D context')
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0)
      return points.map(([x, y]) => Array.from(context.getImageData(x, y, 1, 1).data.slice(0, 3)))
    },
    { url: svgDataURL(svg), points }
  )
}

function expectRGB(actual: number[], expected: number[]) {
  for (const [channel, value] of expected.entries()) {
    expect(Math.abs(actual[channel] - value), `RGB ${actual} vs ${expected}`).toBeLessThanOrEqual(3)
  }
}

test('an imported clip path still clips after SVG export (#2274)', async ({ page }) => {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const frame = createSVGNodes(
    graph,
    pageId,
    `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="30">
      <defs><clipPath id="window"><rect width="20" height="20"/></clipPath></defs>
      <rect width="60" height="30" fill="#ffffff"/>
      <g clip-path="url(#window)"><rect x="10" width="35" height="20" fill="#ff0000"/></g>
    </svg>`
  )
  if (!frame) throw new Error('nothing imported')
  const svg = renderNodesToSVG(graph, pageId, [frame.id], {
    useAbsoluteBounds: true,
    xmlDeclaration: false
  })
  if (!svg) throw new Error('nothing exported')
  const [clipOnly, inside, outside] = await pixels(page, svg, [
    [5, 5],
    [15, 5],
    [30, 5]
  ])
  expectRGB(clipOnly, [255, 255, 255])
  expectRGB(inside, [255, 0, 0])
  expectRGB(outside, [255, 255, 255])
})

test('exported masks reveal what the canvas reveals', async ({ page }) => {
  const svg = exportedSVG((graph, pageId) => {
    const frame = graph.createNode('FRAME', pageId, { width: 90, height: 20, fills: [WHITE] })
    // An outline mask ignores its fill's opacity.
    const outline = graph.createNode('FRAME', frame.id, { width: 20, height: 20 })
    graph.createNode('RECTANGLE', outline.id, {
      width: 20,
      height: 20,
      isMask: true,
      maskType: 'VECTOR',
      fills: [solid(0, 0, 0, 0.25)]
    })
    graph.createNode('RECTANGLE', outline.id, { width: 20, height: 20, fills: [RED] })
    // A white luminance mask at half opacity reveals a quarter, as in Figma.
    const luminance = graph.createNode('FRAME', frame.id, { x: 30, width: 20, height: 20 })
    graph.createNode('RECTANGLE', luminance.id, {
      width: 20,
      height: 20,
      isMask: true,
      maskType: 'LUMINANCE',
      opacity: 0.5,
      fills: [WHITE]
    })
    graph.createNode('RECTANGLE', luminance.id, { width: 20, height: 20, fills: [RED] })
    // A dark alpha mask beside a luminance mask in one run still reveals by its alpha.
    const mixed = graph.createNode('FRAME', frame.id, { x: 60, width: 30, height: 20 })
    graph.createNode('RECTANGLE', mixed.id, {
      width: 10,
      height: 20,
      isMask: true,
      maskType: 'ALPHA',
      fills: [solid(0, 0, 0)]
    })
    graph.createNode('RECTANGLE', mixed.id, {
      x: 20,
      width: 10,
      height: 20,
      isMask: true,
      maskType: 'LUMINANCE',
      fills: [solid(0, 0, 0)]
    })
    graph.createNode('RECTANGLE', mixed.id, { width: 30, height: 20, fills: [RED] })
    return [frame.id]
  })
  const [outline, luminance, alpha, dark] = await pixels(page, svg, [
    [10, 10],
    [40, 10],
    [65, 10],
    [85, 10]
  ])
  expectRGB(outline, [255, 0, 0])
  expectRGB(luminance, [255, 191, 191])
  expectRGB(alpha, [255, 0, 0])
  expectRGB(dark, [255, 255, 255])
})

test('a group mask leaves its own shadow out', async ({ page }) => {
  const svg = exportedSVG((graph, pageId) => {
    const frame = graph.createNode('FRAME', pageId, { width: 60, height: 20, fills: [WHITE] })
    const mask = graph.createNode('GROUP', frame.id, {
      width: 20,
      height: 20,
      isMask: true,
      maskType: 'ALPHA',
      effects: [
        {
          type: 'DROP_SHADOW',
          radius: 0,
          spread: 0,
          offset: { x: 30, y: 0 },
          color: { r: 0, g: 0, b: 0, a: 1 },
          visible: true
        }
      ]
    })
    graph.createNode('RECTANGLE', mask.id, { width: 20, height: 20, fills: [RED] })
    graph.createNode('RECTANGLE', frame.id, { width: 60, height: 20, fills: [RED] })
    return [frame.id]
  })
  const [inside, shadow] = await pixels(page, svg, [
    [10, 10],
    [40, 10]
  ])
  expectRGB(inside, [255, 0, 0])
  expectRGB(shadow, [255, 255, 255])
})

for (const isMask of [false, true]) {
  test(`a subtracted ${isMask ? 'mask' : 'shape'} keeps its hole`, async ({ page }) => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', pageId, { width: 60, height: 60, fills: [WHITE] })
    const boolean = graph.createNode('BOOLEAN_OPERATION', frame.id, {
      width: 40,
      height: 40,
      booleanOperation: 'SUBTRACT',
      isMask,
      fills: [RED]
    })
    graph.createNode('RECTANGLE', boolean.id, { width: 40, height: 40, fills: [RED] })
    graph.createNode('RECTANGLE', boolean.id, { x: 10, y: 10, width: 20, height: 20, fills: [RED] })
    if (isMask) graph.createNode('RECTANGLE', frame.id, { width: 60, height: 60, fills: [RED] })
    const { data } = await new IORegistry(BUILTIN_IO_FORMATS).exportContent('svg', {
      graph,
      target: { scope: 'node', nodeId: frame.id }
    })
    if (typeof data !== 'string') throw new Error('expected SVG markup')
    const [ring, hole, outside] = await pixels(page, data, [
      [5, 5],
      [20, 20],
      [50, 50]
    ])
    expectRGB(ring, [255, 0, 0])
    expectRGB(hole, [255, 255, 255])
    expectRGB(outside, [255, 255, 255])
  })
}
