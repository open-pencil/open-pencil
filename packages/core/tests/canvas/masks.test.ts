import { afterAll, describe, expect, test, mock } from 'bun:test'
import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit, renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type MaskType, type SceneNode } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'
import type { Canvas, InputRect, Paint } from 'canvaskit-wasm'

import { renderNode } from '#core/canvas/scene'
import { RenderedBoundsCache } from '#core/canvas/renderer/visual-bounds'
import { asCanvas, asRenderer } from './helpers'

const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

const solid = (r: number, g: number, b: number, opacity = 1) => ({
  type: 'SOLID' as const,
  color: { r, g, b, a: 1 },
  opacity,
  visible: true
})

/** The alpha of a red square masked by an 80px ellipse, at the centre of the 100px frame. */
function maskedAlpha(maskType: MaskType, mask: Partial<SceneNode>): number {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const frame = graph.createNode('FRAME', page, { width: 100, height: 100, fills: [] })
  const group = graph.createNode('GROUP', frame.id, { width: 100, height: 100 })
  graph.createNode('ELLIPSE', group.id, {
    x: 10,
    y: 10,
    width: 80,
    height: 80,
    fills: [maskType === 'LUMINANCE' ? solid(1, 1, 1) : solid(0, 0, 0)],
    isMask: true,
    maskType,
    ...mask
  })
  graph.createNode('RECTANGLE', group.id, { width: 100, height: 100, fills: [solid(1, 0, 0)] })
  const png = expectDefined(
    renderNodesToImage(ck, renderer, graph, page, [frame.id], {
      scale: 1,
      format: 'PNG',
      trimTransparent: false
    })
  )
  const image = expectDefined(ck.MakeImageFromEncoded(png))
  try {
    const pixels = expectDefined(
      image.readPixels(50, 50, {
        width: 1,
        height: 1,
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB
      })
    )
    return pixels[3]
  } finally {
    image.delete()
  }
}

// Values read from Figma 126 exports of the same scene.
describe('a mask draws what it masks as Figma does', () => {
  test('through its opacity, which a luminance mask applies twice', () => {
    expect(maskedAlpha('ALPHA', { opacity: 0.5 })).toBe(128)
    expect(maskedAlpha('VECTOR', { opacity: 0.5 })).toBe(128)
    expect(maskedAlpha('LUMINANCE', { opacity: 0.5 })).toBe(64)
  })

  test('with an outline mask ignoring how opaque its fill is', () => {
    expect(maskedAlpha('ALPHA', { fills: [solid(0, 0, 0, 0.5)] })).toBe(128)
    expect(maskedAlpha('VECTOR', { fills: [solid(0, 0, 0, 0.5)] })).toBe(255)
  })

  test('without its blend mode', () => {
    for (const maskType of ['ALPHA', 'VECTOR', 'LUMINANCE'] as const) {
      expect(maskedAlpha(maskType, { blendMode: 'MULTIPLY' })).toBe(255)
    }
  })
})

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function createCanvas() {
  return {
    save: mock(() => undefined),
    restore: mock(() => undefined),
    translate: mock(() => undefined),
    concat: mock(() => undefined),
    rotate: mock(() => undefined),
    scale: mock(() => undefined),
    saveLayer: mock((_paint?: Paint, _bounds?: InputRect | null) => undefined),
    clipRect: mock(() => undefined),
    clipRRect: mock(() => undefined)
  }
}

function createRenderer() {
  const rendered: string[] = []
  const renderer = {
    drawCounts: { nodes: 0, culled: 0 },
    worldViewport: { x: -100, y: -100, w: 1000, h: 1000 },
    ck: {
      BlendMode: { SrcOver: 'SrcOver', DstIn: 'DstIn' },
      LTRBRect: mock(() => new Float32Array(4)),
      ClipOp: { Intersect: 'Intersect' },
      ColorFilter: {
        MakeLuma: mock(() => ({ delete: mock(() => undefined) }))
      }
    },
    opacityPaint: {
      setAlphaf: mock(() => undefined),
      setBlendMode: mock(() => undefined)
    },
    renderedBounds: new RenderedBoundsCache(),
    effectLayerPaint: {
      setImageFilter: mock(() => undefined),
      setColorFilter: mock(() => undefined),
      setBlendMode: mock(() => undefined)
    },
    getCachedBlur: mock(() => null),
    renderShape: mock((_canvas: Canvas, node) => {
      rendered.push(node.id)
    }),
    renderSection: mock((_canvas: Canvas, node) => {
      rendered.push(node.id)
    }),
    renderComponentSet: mock((_canvas: Canvas, node) => {
      rendered.push(node.id)
    }),
    renderNode(...args: Parameters<SkiaRenderer['renderNode']>) {
      renderNode(asRenderer(this), ...args)
    }
  }
  return { renderer: asRenderer(renderer), rendered }
}

describe('canvas masks', () => {
  test('uses a visible mask node to clip following siblings', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), { width: 200, height: 200 })
    const below = graph.createNode('RECTANGLE', frame.id, { width: 200, height: 200 })
    const mask = graph.createNode('ELLIPSE', frame.id, {
      width: 100,
      height: 100,
      isMask: true
    })
    const clipped = graph.createNode('RECTANGLE', frame.id, { width: 200, height: 200 })
    const { renderer, rendered } = createRenderer()
    const canvas = createCanvas()

    renderNode(renderer, asCanvas(canvas), graph, frame.id, {})

    expect(rendered).toEqual([frame.id, below.id, clipped.id, mask.id])
    expect(renderer.effectLayerPaint.setBlendMode).toHaveBeenCalledWith('DstIn')
    expect(renderer.effectLayerPaint.setBlendMode).toHaveBeenLastCalledWith('SrcOver')
    expect(canvas.saveLayer).toHaveBeenCalledTimes(2)
    expect(renderer.ck.LTRBRect).toHaveBeenCalledWith(0, 0, 100, 100)
    for (const call of canvas.saveLayer.mock.calls) {
      expect(call[1]).toBeInstanceOf(Float32Array)
    }
  })

  test('combines consecutive mask nodes before clipping following siblings', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), { width: 200, height: 200 })
    const firstMask = graph.createNode('RECTANGLE', frame.id, {
      width: 80,
      height: 80,
      isMask: true
    })
    const secondMask = graph.createNode('ELLIPSE', frame.id, {
      width: 80,
      height: 80,
      isMask: true
    })
    const clipped = graph.createNode('RECTANGLE', frame.id, { width: 200, height: 200 })
    const nextMask = graph.createNode('RECTANGLE', frame.id, {
      width: 40,
      height: 40,
      isMask: true
    })
    const nextClipped = graph.createNode('RECTANGLE', frame.id, { width: 100, height: 100 })
    const { renderer, rendered } = createRenderer()
    const canvas = createCanvas()

    renderNode(renderer, asCanvas(canvas), graph, frame.id, {})

    expect(rendered).toEqual([
      frame.id,
      clipped.id,
      firstMask.id,
      secondMask.id,
      nextClipped.id,
      nextMask.id
    ])
    expect(canvas.saveLayer).toHaveBeenCalledTimes(4)
  })

  test('applies luminance masks through a luma color filter', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), { width: 200, height: 200 })
    const mask = graph.createNode('RECTANGLE', frame.id, {
      width: 100,
      height: 100,
      isMask: true,
      maskType: 'LUMINANCE'
    })
    const clipped = graph.createNode('RECTANGLE', frame.id, { width: 200, height: 200 })
    const { renderer, rendered } = createRenderer()
    const canvas = createCanvas()

    renderNode(renderer, asCanvas(canvas), graph, frame.id, {})

    // The mask draws once for its luma and once more to scale that by its alpha, as Figma does.
    expect(rendered).toEqual([frame.id, clipped.id, mask.id, mask.id])
    expect(renderer.ck.ColorFilter.MakeLuma).toHaveBeenCalled()
    expect(renderer.effectLayerPaint.setColorFilter).toHaveBeenCalledWith(expect.any(Object))
    expect(renderer.effectLayerPaint.setColorFilter).toHaveBeenLastCalledWith(null)
  })

  test('does not draw mask nodes as ordinary layers', () => {
    const graph = new SceneGraph()
    const mask = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      isMask: true
    })
    const { renderer, rendered } = createRenderer()

    renderNode(renderer, asCanvas(createCanvas()), graph, mask.id, {})

    expect(rendered).toEqual([])
  })
})
