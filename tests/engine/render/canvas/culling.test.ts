import { describe, expect, mock, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { renderNode } from '#core/canvas/scene'

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
    worldViewport: { x: 900, y: 900, w: 300, h: 300 },
    opacityPaint: { setAlphaf: mock(() => undefined) },
    effectLayerPaint: {
      setImageFilter: mock(() => undefined),
      setColorFilter: mock(() => undefined),
      setBlendMode: mock(() => undefined)
    },
    ck: {
      BlendMode: { SrcOver: 'SrcOver' },
      LTRBRect: mock((left: number, top: number, right: number, bottom: number) => [
        left,
        top,
        right,
        bottom
      ]),
      ClipOp: { Intersect: 'Intersect' }
    },
    getCachedBlur: mock(() => null),
    renderShape: mock((_canvas, node) => {
      rendered.push(node.id)
    }),
    renderSection: mock((_canvas, node) => {
      rendered.push(node.id)
    }),
    renderComponentSet: mock((_canvas, node) => {
      rendered.push(node.id)
    }),
    renderNode(canvas, graph, nodeId, overlays, parentAbsX, parentAbsY, hasTransformedAncestor) {
      renderNode(
        this as SkiaRenderer,
        canvas,
        graph,
        nodeId,
        overlays,
        parentAbsX,
        parentAbsY,
        hasTransformedAncestor
      )
    }
  }
  return { renderer: renderer as SkiaRenderer, rendered }
}

describe('canvas culling', () => {
  test('uses accumulated absolute position for nested children', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      x: 1000,
      y: 1000,
      width: 200,
      height: 200
    })
    const text = graph.createNode('TEXT', frame.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 24,
      text: 'Visible nested text'
    })
    const { renderer, rendered } = createRenderer()

    renderNode(renderer, createCanvas(), graph, frame.id, {})

    expect(rendered).toContain(frame.id)
    expect(rendered).toContain(text.id)
    expect(renderer._culledCount).toBe(0)
  })

  test('uses world bounds for children of transformed instances', () => {
    const graph = new SceneGraph()
    const instance = graph.createNode('INSTANCE', pageId(graph), {
      x: 1000,
      y: 1000,
      width: 100,
      height: 800,
      rotation: 90
    })
    const connector = graph.createNode('VECTOR', instance.id, {
      x: 0,
      y: 700,
      width: 100,
      height: 20
    })
    const { renderer, rendered } = createRenderer()
    renderer.worldViewport = { x: 700, y: 1300, w: 300, h: 300 }

    renderNode(renderer, createCanvas(), graph, instance.id, {})

    expect(rendered).toContain(connector.id)
    expect(renderer._culledCount).toBe(0)
  })

  test('applies reflection before rotation like the scene transform matrix', () => {
    const graph = new SceneGraph()
    const vector = graph.createNode('VECTOR', pageId(graph), {
      width: 100,
      height: 50,
      rotation: 90,
      flipX: true
    })
    const { renderer } = createRenderer()
    renderer.worldViewport = { x: -100, y: -100, w: 300, h: 300 }
    const canvas = createCanvas()
    const transformOrder: string[] = []
    canvas.scale = mock(() => transformOrder.push('scale'))
    canvas.rotate = mock(() => transformOrder.push('rotate'))

    renderNode(renderer, canvas, graph, vector.id, {})

    expect(transformOrder).toEqual(['scale', 'rotate'])
  })
})
