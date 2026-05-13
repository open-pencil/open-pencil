import { describe, expect, mock, test } from 'bun:test'

import { renderNode } from '#core/canvas/scene'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { SceneGraph } from '#core/scene-graph'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function createCanvas() {
  return {
    save: mock(() => undefined),
    restore: mock(() => undefined),
    translate: mock(() => undefined),
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
    renderNode(canvas, graph, nodeId, overlays, parentAbsX, parentAbsY) {
      renderNode(this as SkiaRenderer, canvas, graph, nodeId, overlays, parentAbsX, parentAbsY)
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
})
