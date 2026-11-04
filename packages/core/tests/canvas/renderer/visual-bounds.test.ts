import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { computeContentBounds } from '@open-pencil/core/io/formats/raster'
import {
  SceneGraph,
  type Effect,
  type NodeType,
  type SceneNode,
  type Stroke
} from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'

function close(
  actual: unknown,
  expected: { minX: number; minY: number; maxX: number; maxY: number }
) {
  expect(actual).toEqual({
    minX: expect.closeTo(expected.minX, 6),
    minY: expect.closeTo(expected.minY, 6),
    maxX: expect.closeTo(expected.maxX, 6),
    maxY: expect.closeTo(expected.maxY, 6)
  })
}

function emptyPage() {
  const graph = new SceneGraph()
  return { graph, pageId: expectDefined(graph.getPages()[0]).id }
}

function boundsOf(props: Partial<SceneNode>, type: NodeType = 'RECTANGLE') {
  const { graph, pageId } = emptyPage()
  const node = graph.createNode(type, pageId, { x: 100, y: 200, width: 50, height: 60, ...props })
  return expectDefined(computeContentBounds(graph, [node.id]))
}

function stroke(weight: number, align: Stroke['align'], visible = true): Stroke {
  return { type: 'SOLID', weight, visible, align, color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1 }
}

function shadow(radius: number, offset: Vector, visible = true, spread = 0): Effect {
  return {
    type: 'DROP_SHADOW',
    visible,
    radius,
    spread,
    offset,
    color: { r: 0, g: 0, b: 0, a: 0.5 }
  }
}

function commandsBlobFromPoints(points: Vector[]): Uint8Array {
  const blob = new Uint8Array(points.length * 9 + 1)
  const view = new DataView(blob.buffer)
  let offset = 0
  for (const point of points) {
    blob[offset] = 1
    view.setFloat32(offset + 1, point.x, true)
    view.setFloat32(offset + 5, point.y, true)
    offset += 9
  }
  blob[offset] = 0
  return blob
}

const plain = { minX: 100, minY: 200, maxX: 150, maxY: 260 }

describe('content bounds', () => {
  test('hold a turned frame where it draws, turned about its centre', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      x: 250,
      y: 250,
      width: 300,
      height: 180,
      rotation: 90
    })

    close(computeContentBounds(graph, [frame.id]), { minX: 310, minY: 190, maxX: 490, maxY: 490 })
  })

  test('hold a child of a turned parent where the parent puts it', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const parent = graph.createNode('FRAME', page.id, {
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      rotation: 90,
      clipsContent: false
    })
    const child = graph.createNode('RECTANGLE', parent.id, { x: 120, y: 0, width: 40, height: 10 })
    const corners = Matrix.mapPoints(getWorldMatrix(child, graph), [0, 0, 40, 0, 40, 10, 0, 10])
    const xs = corners.filter((_, index) => index % 2 === 0)
    const ys = corners.filter((_, index) => index % 2 === 1)

    close(computeContentBounds(graph, [child.id]), {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys)
    })
    const both = computeContentBounds(graph, [parent.id])
    expect(both?.minX).toBeCloseTo(Math.min(100, ...xs), 6)
    expect(both?.maxY).toBeCloseTo(Math.max(200, ...ys), 6)
  })

  test('leave out hidden layers', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const shown = graph.createNode('RECTANGLE', page.id, { width: 10, height: 10 })
    const hidden = graph.createNode('RECTANGLE', page.id, {
      x: 50,
      width: 10,
      height: 10,
      visible: false
    })

    expect(computeContentBounds(graph, [hidden.id])).toBeNull()
    close(computeContentBounds(graph, [shown.id, hidden.id]), {
      minX: 0,
      minY: 0,
      maxX: 10,
      maxY: 10
    })
  })

  test('leave out hidden children of visible layers', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      width: 100,
      height: 100,
      clipsContent: false
    })
    graph.createNode('RECTANGLE', frame.id, { x: 120, width: 40, height: 10, visible: false })

    close(computeContentBounds(graph, [frame.id]), { minX: 0, minY: 0, maxX: 100, maxY: 100 })
  })

  test('nothing visible has no bounds', () => {
    const { graph } = emptyPage()
    expect(computeContentBounds(graph, [])).toBeNull()
    expect(computeContentBounds(graph, ['missing'])).toBeNull()
  })

  test('a single axis-aligned node is its box', () => {
    expect(boundsOf({})).toEqual(plain)
  })

  test('several nodes give their union', () => {
    const { graph, pageId } = emptyPage()
    const a = graph.createNode('RECTANGLE', pageId, { x: 100, y: 200, width: 50, height: 60 })
    const b = graph.createNode('RECTANGLE', pageId, { x: 300, y: 400, width: 30, height: 30 })
    expect(computeContentBounds(graph, [a.id, b.id])).toEqual({
      minX: 100,
      minY: 200,
      maxX: 330,
      maxY: 430
    })
  })

  test('a rotated node grows its box', () => {
    const rotated = boundsOf({ width: 100, height: 50, rotation: 45 })
    expect(rotated.maxX - rotated.minX).toBeGreaterThan(100)
    expect(rotated.maxY - rotated.minY).toBeGreaterThan(50)
  })

  test('an OUTSIDE stroke grows each side by its weight', () => {
    expect(boundsOf({ strokes: [stroke(10, 'OUTSIDE')] })).toEqual({
      minX: 90,
      minY: 190,
      maxX: 160,
      maxY: 270
    })
  })

  test('a CENTER stroke grows each side by half its weight', () => {
    expect(boundsOf({ strokes: [stroke(10, 'CENTER')] })).toEqual({
      minX: 95,
      minY: 195,
      maxX: 155,
      maxY: 265
    })
  })

  test('INSIDE and invisible strokes leave the box as it is', () => {
    expect(boundsOf({ strokes: [stroke(10, 'INSIDE')] })).toEqual(plain)
    expect(boundsOf({ strokes: [stroke(100, 'OUTSIDE', false)] })).toEqual(plain)
  })

  test('several strokes take the largest overflow', () => {
    const strokes = [stroke(2, 'OUTSIDE'), stroke(8, 'CENTER'), stroke(4, 'INSIDE')]
    expect(boundsOf({ strokes })).toEqual({ minX: 96, minY: 196, maxX: 154, maxY: 264 })
  })

  test('a drop shadow grows the side it is offset to', () => {
    expect(boundsOf({ effects: [shadow(10, { x: 5, y: -3 })] })).toEqual({
      minX: 90,
      minY: 187,
      maxX: 165,
      maxY: 270
    })
  })

  test('a layer blur grows every side by its radius', () => {
    const blur: Effect = { ...shadow(20, { x: 0, y: 0 }), type: 'LAYER_BLUR' }
    expect(boundsOf({ effects: [blur] })).toEqual({ minX: 80, minY: 180, maxX: 170, maxY: 280 })
  })

  test('an invisible effect leaves the box as it is', () => {
    expect(boundsOf({ effects: [shadow(100, { x: 200, y: 200 }, false, 50)] })).toEqual(plain)
  })

  test('a stroke and a shadow add up', () => {
    const bounds = boundsOf({
      strokes: [stroke(5, 'OUTSIDE')],
      effects: [shadow(10, { x: 3, y: 3 })]
    })
    expect(bounds).toEqual({ minX: 85, minY: 185, maxX: 168, maxY: 278 })
  })

  test('several effects take the largest overflow on each side', () => {
    const effects = [shadow(5, { x: 10, y: 0 }), shadow(3, { x: -10, y: 0 })]
    expect(boundsOf({ effects })).toEqual({ minX: 87, minY: 195, maxX: 165, maxY: 265 })
  })

  test('inside stroke geometry does not grow the box, outside stroke geometry does', () => {
    const strokeGeometry = [
      {
        commandsBlob: commandsBlobFromPoints([
          { x: -3, y: -3 },
          { x: 103, y: 53 }
        ]),
        windingRule: 'NONZERO' as const
      }
    ]
    const at = { x: 10, y: 20, width: 100, height: 50, strokeGeometry }
    expect(boundsOf({ ...at, strokes: [stroke(1, 'INSIDE')] }, 'COMPONENT')).toEqual({
      minX: 10,
      minY: 20,
      maxX: 110,
      maxY: 70
    })
    expect(boundsOf({ ...at, strokes: [stroke(1, 'OUTSIDE')] }, 'FRAME')).toEqual({
      minX: 7,
      minY: 17,
      maxX: 113,
      maxY: 73
    })
  })

  test('a descendant line reaches as far as its arrow head', () => {
    const { graph, pageId } = emptyPage()
    const frame = graph.createNode('FRAME', pageId, { width: 100, height: 50, fills: [] })
    graph.createNode('LINE', frame.id, {
      width: 100,
      height: 0,
      strokeCap: 'ARROW_EQUILATERAL',
      strokes: [stroke(4, 'CENTER')]
    })
    const bounds = expectDefined(computeContentBounds(graph, [frame.id]))
    // A triangle head reaches furthest on a short line: from the end to its base corners. A
    // line's head sits on its stroke's middle, half a weight off the line.
    expect(bounds.minY).toBeCloseTo(-4 * Math.hypot(5, 5 / Math.sqrt(3)) - 2, 5)
  })

  test('a clipping frame keeps descendants past its edge out', () => {
    const { graph, pageId } = emptyPage()
    const root = graph.createNode('FRAME', pageId, { width: 100, height: 100, clipsContent: true })
    const row = graph.createNode('FRAME', root.id, {
      y: 120,
      width: 100,
      height: 50,
      clipsContent: true
    })
    graph.createNode('FRAME', row.id, { width: 50, height: 50 })
    expect(computeContentBounds(graph, [root.id])).toEqual({
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 100
    })
  })

  test('a clipping ancestor outside the export does not clip it', () => {
    const { graph, pageId } = emptyPage()
    const clip = graph.createNode('FRAME', pageId, { width: 100, height: 100, clipsContent: true })
    const child = graph.createNode('RECTANGLE', clip.id, { x: 80, width: 50, height: 20 })
    expect(computeContentBounds(graph, [child.id])).toEqual({
      minX: 80,
      minY: 0,
      maxX: 130,
      maxY: 20
    })
  })
})

describe('text past its box', () => {
  function textBounds(props: Partial<SceneNode>) {
    return boundsOf({ x: 10, y: 20, width: 110, height: 40, ...props }, 'TEXT')
  }

  // Figma 126 draws a fixed-size text's lines past its box.
  test('lines past a fixed-size box reach the visual bounds', () => {
    expect(textBounds({ derivedTextHeight: 154 })).toEqual({
      minX: 10,
      minY: 20,
      maxX: 120,
      maxY: 174
    })
  })

  test('lines past the box turn with the text', () => {
    const bounds = textBounds({ derivedTextHeight: 154, rotation: 90 })
    expect(bounds.maxX - bounds.minX).toBeCloseTo(154)
    expect(bounds.maxY - bounds.minY).toBeCloseTo(110)
  })

  test('lines within the box leave it as it is', () => {
    expect(textBounds({ derivedTextHeight: 30 }).maxY).toBe(60)
  })

  test('an underline reaches below the box', () => {
    const normal = textBounds({ height: 23, fontSize: 32 })
    const decorated = textBounds({
      height: 23,
      fontSize: 32,
      textDecoration: 'UNDERLINE',
      textUnderlineOffset: 5,
      textDecorationThickness: 2
    })
    expect(normal.maxY).toBe(43)
    expect(decorated.maxY).toBeCloseTo(61.2, 6)
  })
})
