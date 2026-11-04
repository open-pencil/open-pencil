import { afterAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type Stroke } from '@open-pencil/scene-graph'

const ck = await initCanvasKit()
const WIDTH = 200
const HEIGHT = 120

const RED: Stroke = {
  type: 'SOLID',
  color: { r: 1, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  weight: 4,
  align: 'CENTER'
}

const DASHED: Stroke = {
  type: 'SOLID',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  weight: 2,
  align: 'CENTER',
  dashPattern: [4, 4]
}

type Second = 'SECTION' | 'BOOLEAN_OPERATION' | 'ELLIPSE'

/** A page with an optional dashed shape, then `second` stroked in red; returns the page's pixels. */
function renderPage(first: 'ELLIPSE' | 'RECTANGLE' | null, second: Second, stroke = RED) {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  if (first) {
    graph.createNode(first, page.id, {
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      fills: [],
      strokes: [DASHED]
    })
  }
  const placement = { x: 60, y: 10, width: 100, height: 100, fills: [], strokes: [stroke] }
  if (second === 'BOOLEAN_OPERATION') {
    const boolean = graph.createNode('BOOLEAN_OPERATION', page.id, {
      ...placement,
      booleanOperation: 'UNION'
    })
    graph.createNode('RECTANGLE', boolean.id, { x: 0, y: 0, width: 100, height: 100, fills: [] })
  } else {
    graph.createNode(second, page.id, placement)
  }
  const surface = expectDefined(ck.MakeSurface(WIDTH, HEIGHT), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  try {
    renderer.pageId = page.id
    renderer.renderSceneToCanvas(surface.getCanvas(), graph, page.id)
    surface.flush()
    const image = surface.makeImageSnapshot()
    const pixels = image.readPixels(0, 0, {
      width: WIDTH,
      height: HEIGHT,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    })
    image.delete()
    return expectDefined(pixels, 'pixels')
  } finally {
    renderer.destroy()
  }
}

function count(
  pixels: Uint8Array | Float32Array,
  keep: (r: number, g: number, b: number) => boolean
) {
  let total = 0
  for (let index = 0; index < pixels.length; index += 4) {
    const r = pixels[index] ?? 0
    const g = pixels[index + 1] ?? 0
    const b = pixels[index + 2] ?? 0
    if (keep(r, g, b)) total++
  }
  return total
}

const isRed = (r: number, g: number) => r > 200 && g < 60

describe('stroke paint state between nodes', () => {
  afterAll(() => undefined)

  test.each<Second>(['SECTION', 'BOOLEAN_OPERATION', 'ELLIPSE'])(
    'a %s strokes the same after a dashed ellipse or rectangle as alone',
    (second) => {
      const alone = count(renderPage(null, second), isRed)
      expect(alone).toBeGreaterThan(0)
      expect(count(renderPage('ELLIPSE', second), isRed)).toBe(alone)
      expect(count(renderPage('RECTANGLE', second), isRed)).toBe(alone)
    }
  )

  test('a boolean draws its own dash and its own gradient', () => {
    const solid = count(renderPage(null, 'BOOLEAN_OPERATION'), isRed)
    const dashed = count(
      renderPage(null, 'BOOLEAN_OPERATION', { ...RED, dashPattern: [8, 8] }),
      isRed
    )
    expect(dashed).toBeGreaterThan(0)
    expect(dashed).toBeLessThan(solid * 0.7)

    const gradient = renderPage(null, 'BOOLEAN_OPERATION', {
      ...RED,
      type: 'GRADIENT_LINEAR',
      gradientStops: [
        { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
        { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
      ],
      gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    })
    expect(count(gradient, isRed)).toBeGreaterThan(0)
    expect(count(gradient, (r, _g, b) => b > 200 && r < 60)).toBeGreaterThan(0)
  })
})
