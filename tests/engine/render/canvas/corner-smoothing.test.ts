import { describe, expect, mock, test } from 'bun:test'

import type { Canvas } from 'canvaskit-wasm'

import { SceneGraph } from '@open-pencil/scene-graph'

import { drawNodeFill } from '#core/canvas/fills'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { makeSmoothRRectPath } from '#core/canvas/shapes'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function createRenderer() {
  const paths: Array<{
    addRect: ReturnType<typeof mock>
    moveTo: ReturnType<typeof mock>
    lineTo: ReturnType<typeof mock>
    cubicTo: ReturnType<typeof mock>
    arcToRotated: ReturnType<typeof mock>
    close: ReturnType<typeof mock>
    delete: ReturnType<typeof mock>
  }> = []

  class MockPath {
    addRect = mock(() => undefined)
    moveTo = mock(() => undefined)
    lineTo = mock(() => undefined)
    cubicTo = mock(() => undefined)
    arcToRotated = mock(() => undefined)
    close = mock(() => undefined)
    delete = mock(() => undefined)

    constructor() {
      paths.push(this)
    }
  }

  const renderer = {
    ck: {
      Path: MockPath,
      LTRBRect: mock((l, t, r, b) => new Float32Array([l, t, r, b]))
    },
    fillPaint: {}
  } as SkiaRenderer

  return { renderer, paths }
}

function createCanvas() {
  return {
    drawPath: mock(() => undefined),
    drawRRect: mock(() => undefined),
    drawRect: mock(() => undefined)
  }
}

describe('canvas corner smoothing', () => {
  test('builds cubic paths for smoothed rectangular corners', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 120,
      height: 80,
      cornerRadius: 24,
      cornerSmoothing: 0.75
    })
    const { renderer, paths } = createRenderer()

    makeSmoothRRectPath(renderer, node).delete()

    expect(paths).toHaveLength(1)
    expect(paths[0].moveTo).toHaveBeenCalledWith(80, 0)
    expect(paths[0].lineTo).toHaveBeenCalledWith(120, 40)
    expect(paths[0].arcToRotated).toHaveBeenCalledTimes(4)
    expect(paths[0].cubicTo).toHaveBeenCalledTimes(8)
    expect(paths[0].lineTo).toHaveBeenCalledTimes(3)
    expect(paths[0].close).toHaveBeenCalled()
  })

  test('supports independent smoothed corner radii', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 120,
      height: 80,
      independentCorners: true,
      topLeftRadius: 28,
      topRightRadius: 12,
      bottomRightRadius: 32,
      bottomLeftRadius: 0,
      cornerSmoothing: 1
    })
    const { renderer, paths } = createRenderer()

    makeSmoothRRectPath(renderer, node).delete()

    expect(paths).toHaveLength(1)
    expect(paths[0].moveTo).toHaveBeenCalledWith(98.18181818181819, 0)
    expect(paths[0].arcToRotated).toHaveBeenCalledTimes(3)
    expect(paths[0].cubicTo).toHaveBeenCalledTimes(6)
    expect(paths[0].lineTo).toHaveBeenCalledWith(0, 80)
  })

  test('draws smoothed rectangle fills as paths instead of regular rrects', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 120,
      height: 80,
      cornerRadius: 24,
      cornerSmoothing: 0.75
    })
    const { renderer } = createRenderer()
    const canvas = createCanvas()

    drawNodeFill(renderer, canvas as Canvas, node, new Float32Array([0, 0, 120, 80]), true)

    expect(canvas.drawPath).toHaveBeenCalled()
    expect(canvas.drawRRect).not.toHaveBeenCalled()
    expect(canvas.drawRect).not.toHaveBeenCalled()
  })
})
