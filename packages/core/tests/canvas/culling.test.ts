import { describe, expect, mock, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'
import { expectDefined } from '@open-pencil/test-support/assert'

import type { SkiaRenderer } from '#core/canvas/renderer/skia'
import { RenderedBoundsCache } from '#core/canvas/renderer/visual-bounds'
import { renderNode } from '#core/canvas/scene'

import { asCanvas, asRenderer } from './helpers'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function createCanvas() {
  return {
    save: mock(() => undefined),
    restore: mock(() => undefined),
    translate: mock(() => undefined),
    concat: mock((_matrix: Mat3) => undefined),
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
    drawCounts: { nodes: 0, culled: 0 },
    renderedBounds: new RenderedBoundsCache(),
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
    renderNode(...args: Parameters<SkiaRenderer['renderNode']>) {
      renderNode(asRenderer(this), ...args)
    }
  }
  return { renderer: asRenderer(renderer), rendered }
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

    renderNode(renderer, asCanvas(createCanvas()), graph, frame.id, {})

    expect(rendered).toContain(frame.id)
    expect(rendered).toContain(text.id)
    expect(renderer.drawCounts.culled).toBe(0)
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

    renderNode(renderer, asCanvas(createCanvas()), graph, instance.id, {})

    expect(rendered).toContain(connector.id)
    expect(renderer.drawCounts.culled).toBe(0)
  })

  test('culling follows an ancestor rotation preview before the graph commits', () => {
    const graph = new SceneGraph()
    const instance = graph.createNode('INSTANCE', pageId(graph), {
      x: 1000,
      y: 1000,
      width: 100,
      height: 800
    })
    const connector = graph.createNode('VECTOR', instance.id, {
      x: 0,
      y: 700,
      width: 100,
      height: 20
    })
    const { renderer, rendered } = createRenderer()
    renderer.worldViewport = { x: 700, y: 1300, w: 300, h: 300 }
    renderNode(renderer, asCanvas(createCanvas()), graph, instance.id, {
      rotationPreview: { nodeId: instance.id, angle: 90 }
    })
    expect(rendered).toContain(connector.id)
    expect(instance.rotation).toBe(0)
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
    renderNode(renderer, asCanvas(canvas), graph, vector.id, {})

    const matrix = expectDefined(canvas.concat.mock.calls[0]?.[0], 'drawing transform')
    const start = Matrix.mapPoint(matrix, { x: 0, y: 0 })
    const end = Matrix.mapPoint(matrix, { x: 100, y: 50 })
    expect(start.x).toBeCloseTo(25, 9)
    expect(start.y).toBeCloseTo(-25, 9)
    expect(end.x).toBeCloseTo(75, 9)
    expect(end.y).toBeCloseTo(75, 9)
  })

  test('draws a layer outside the viewport whose shadow reaches into it', () => {
    const graph = new SceneGraph()
    const rectangle = graph.createNode('RECTANGLE', pageId(graph), {
      x: 800,
      y: 1000,
      width: 80,
      height: 80,
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 40, y: 0 },
          radius: 8,
          spread: 0,
          visible: true,
          blendMode: 'NORMAL'
        }
      ]
    })
    const { renderer, rendered } = createRenderer()

    renderNode(renderer, asCanvas(createCanvas()), graph, rectangle.id, {})

    expect(rendered).toContain(rectangle.id)
    expect(renderer.drawCounts.culled).toBe(0)
  })

  test('draws a layer outside the viewport whose outside stroke reaches into it', () => {
    const graph = new SceneGraph()
    const rectangle = graph.createNode('RECTANGLE', pageId(graph), {
      x: 880,
      y: 1000,
      width: 16,
      height: 16,
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          weight: 10,
          align: 'OUTSIDE'
        }
      ]
    })
    const { renderer, rendered } = createRenderer()

    renderNode(renderer, asCanvas(createCanvas()), graph, rectangle.id, {})

    expect(rendered).toContain(rectangle.id)
  })

  test('culls a group whose layers all lie outside the viewport, without visiting them', () => {
    const graph = new SceneGraph()
    const group = graph.createNode('GROUP', pageId(graph), { x: 0, y: 0, width: 200, height: 200 })
    for (const x of [0, 100]) {
      graph.createNode('RECTANGLE', group.id, { x, y: 0, width: 100, height: 200 })
    }
    const { renderer, rendered } = createRenderer()

    renderNode(renderer, asCanvas(createCanvas()), graph, group.id, {})

    expect(rendered).toEqual([])
    expect(renderer.drawCounts).toEqual({ nodes: 1, culled: 1 })
  })
})
