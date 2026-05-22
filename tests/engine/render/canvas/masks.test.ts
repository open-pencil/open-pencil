import { describe, expect, mock, test } from 'bun:test'

import type { Canvas } from 'canvaskit-wasm'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { renderNode } from '#core/canvas/scene'
import { SceneGraph } from '#core/scene-graph'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function createCanvas() {
  return {
    save: mock(() => undefined),
    restore: mock(() => undefined),
    translate: mock(() => undefined),
    rotate: mock(() => undefined),
    scale: mock(() => undefined),
    saveLayer: mock(() => undefined),
    clipRect: mock(() => undefined),
    clipRRect: mock(() => undefined)
  }
}

function createRenderer() {
  const rendered: string[] = []
  const renderer = {
    _nodeCount: 0,
    _culledCount: 0,
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
    renderNode(canvas, graph, nodeId, overlays, parentAbsX, parentAbsY) {
      renderNode(this as SkiaRenderer, canvas, graph, nodeId, overlays, parentAbsX, parentAbsY)
    }
  }
  return { renderer: renderer as SkiaRenderer, rendered }
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

    renderNode(renderer, canvas as Canvas, graph, frame.id, {})

    expect(rendered).toEqual([frame.id, below.id, clipped.id, mask.id])
    expect(renderer.effectLayerPaint.setBlendMode).toHaveBeenCalledWith('DstIn')
    expect(renderer.effectLayerPaint.setBlendMode).toHaveBeenLastCalledWith('SrcOver')
    expect(canvas.saveLayer).toHaveBeenCalledTimes(2)
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

    renderNode(renderer, canvas as Canvas, graph, frame.id, {})

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

    renderNode(renderer, canvas as Canvas, graph, frame.id, {})

    expect(rendered).toEqual([frame.id, clipped.id, mask.id])
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

    renderNode(renderer, createCanvas() as Canvas, graph, mask.id, {})

    expect(rendered).toEqual([])
  })
})
