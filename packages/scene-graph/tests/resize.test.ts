import { describe, expect, test } from 'bun:test'

import { SceneGraph, type ConstraintType } from '@open-pencil/scene-graph'
import {
  collectResizeDescendants,
  computeConstrainedResizeChanges,
  constrainedChildRect,
  scaledGeometryChanges
} from '@open-pencil/scene-graph/resize'

// Live Figma, 2026-10-10: a locked 100×50 rectangle at 50,50 in a 200×200 frame.
const child = { x: 50, y: 50, width: 100, height: 50 }
const square = { width: 200, height: 200 }

function resized(
  horizontal: ConstraintType,
  vertical: ConstraintType,
  after: { width: number; height: number },
  ratio: number | null = 2
) {
  return constrainedChildRect(child, square, after, horizontal, vertical, ratio)
}

describe('constraints with a locked aspect ratio', () => {
  test('the one axis that follows the parent sizes the other', () => {
    expect(resized('STRETCH', 'MIN', { width: 300, height: 200 })).toEqual({
      x: 50,
      y: 50,
      width: 200,
      height: 100
    })
    expect(resized('MIN', 'STRETCH', { width: 200, height: 400 })).toEqual({
      x: 50,
      y: 50,
      width: 500,
      height: 250
    })
    expect(resized('SCALE', 'MIN', { width: 300, height: 200 })).toEqual({
      x: 75,
      y: 50,
      width: 150,
      height: 75
    })
  })

  test('the derived axis keeps the edge or centre its constraint pins', () => {
    const wider = { width: 300, height: 200 }
    expect(resized('STRETCH', 'MAX', wider)).toEqual({ x: 50, y: 0, width: 200, height: 100 })
    expect(resized('STRETCH', 'CENTER', wider)).toEqual({ x: 50, y: 25, width: 200, height: 100 })
    const taller = { width: 200, height: 400 }
    expect(resized('MAX', 'SCALE', taller)).toEqual({ x: -50, y: 100, width: 200, height: 100 })
    expect(resized('CENTER', 'SCALE', taller)).toEqual({ x: 0, y: 100, width: 200, height: 100 })
  })

  test('the ratio gives way when both axes or neither follow the parent', () => {
    const wider = { width: 300, height: 200 }
    expect(resized('STRETCH', 'STRETCH', wider)).toEqual({ x: 50, y: 50, width: 200, height: 50 })
    expect(resized('SCALE', 'SCALE', wider)).toEqual({ x: 75, y: 50, width: 150, height: 50 })
    expect(resized('CENTER', 'CENTER', wider)).toEqual({ x: 100, y: 50, width: 100, height: 50 })
  })

  test('an unlocked child follows each constraint on its own', () => {
    expect(resized('STRETCH', 'MIN', { width: 300, height: 200 }, null)).toEqual({
      x: 50,
      y: 50,
      width: 200,
      height: 50
    })
  })
})

// Live Figma, 2026-11-05 (#1816): a 22.6×16.5 rectangle at 0.7,3.75 in a 100×100 frame, resized
// through the plugin API.
describe('constraints keep fractional boxes', () => {
  const fractional = { x: 0.7, y: 3.75, width: 22.6, height: 16.5 }
  const frame = { width: 100, height: 100 }
  const place = (
    horizontal: ConstraintType,
    vertical: ConstraintType,
    after: { width: number; height: number },
    before = frame
  ) => {
    const rect = constrainedChildRect(fractional, before, after, horizontal, vertical)
    return [rect.x, rect.y, rect.width, rect.height].map((v) => Math.round(v * 100000) / 100000)
  }

  test('a resize to the same size, or one the constraints ignore, leaves the box alone', () => {
    expect(place('MIN', 'MIN', frame)).toEqual([0.7, 3.75, 22.6, 16.5])
    expect(place('MIN', 'MIN', { width: 120, height: 100 })).toEqual([0.7, 3.75, 22.6, 16.5])
  })

  test('Right and Left & right follow the change in the parent rounded to whole pixels', () => {
    expect(place('MAX', 'MIN', { width: 120.4, height: 100 })).toEqual([20.7, 3.75, 22.6, 16.5])
    expect(place('STRETCH', 'MIN', { width: 120.4, height: 100 })).toEqual([0.7, 3.75, 42.6, 16.5])
  })

  test('Center follows the change in the rounded half of the parent', () => {
    expect(place('CENTER', 'MIN', { width: 121, height: 100 })).toEqual([11.7, 3.75, 22.6, 16.5])
    expect(place('CENTER', 'MIN', { width: 120.4, height: 100 })).toEqual([10.7, 3.75, 22.6, 16.5])
  })

  test('Scale follows the exact ratio', () => {
    expect(place('SCALE', 'MIN', { width: 130, height: 100 })).toEqual([0.91, 3.75, 29.38, 16.5])
    expect(place('SCALE', 'SCALE', { width: 113, height: 107.3 })).toEqual([
      0.791, 4.02375, 25.538, 17.7045
    ])
  })

  test('Left & right that would leave no size keeps the child as it was', () => {
    const child = { x: 10, y: 10, width: 20, height: 16 }
    expect(
      constrainedChildRect(child, frame, { width: 80, height: 100 }, 'STRETCH', 'MIN')
    ).toEqual(child)
    expect(
      constrainedChildRect(child, frame, { width: 80.4, height: 100 }, 'STRETCH', 'MIN')
    ).toEqual(child)
  })

  test('Left & right shrunk past zero turns the child over, its box running back from its edge', () => {
    const child = { x: 10, y: 10, width: 20, height: 16 }
    const flipped = constrainedChildRect(child, frame, { width: 70, height: 100 }, 'STRETCH', 'MIN')
    expect(flipped).toEqual({ x: 0, y: 10, width: 10, height: 16, flipsX: true })
    // Turned over, it stretches from that box: Figma's 0..10 grows to 0..40.
    const { flipsX: _, ...box } = flipped
    expect(constrainedChildRect(box, { width: 70, height: 100 }, frame, 'STRETCH', 'MIN')).toEqual({
      x: 0,
      y: 10,
      width: 40,
      height: 16
    })
    expect(
      constrainedChildRect(child, frame, { width: 100, height: 79 }, 'MIN', 'STRETCH')
    ).toEqual({ x: 10, y: 5, width: 20, height: 5, flipsY: true })
    expect(
      constrainedChildRect(child, frame, { width: 79, height: 100 }, 'STRETCH', 'MIN')
    ).toEqual({ x: 9, y: 10, width: 1, height: 16, flipsX: true })
  })

  test('a run of resizes back to the start lands where it began', () => {
    for (const constraint of ['MAX', 'CENTER', 'STRETCH', 'SCALE'] as const) {
      let box = fractional
      let parent = frame
      for (const next of [{ width: 120.4, height: 100.6 }, { width: 99.3, height: 100.2 }, frame]) {
        box = constrainedChildRect(box, parent, next, constraint, constraint)
        parent = next
      }
      expect([box.x, box.y, box.width, box.height].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([
        0.7, 3.75, 22.6, 16.5
      ])
    }
  })
})

describe('resizing a frame across zero', () => {
  function stretched() {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, { width: 100, height: 100 })
    const vector = graph.createNode('VECTOR', frame.id, {
      x: 10,
      y: 10,
      width: 20,
      height: 16,
      horizontalConstraint: 'STRETCH',
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 20, y: 16 }
        ],
        segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: []
      }
    })
    const resize = (
      from: number,
      to: number,
      originals = collectResizeDescendants(graph, frame.id)
    ) => {
      if (!originals) throw new Error('Expected the vector')
      graph.updateNode(frame.id, { width: to })
      const changes = computeConstrainedResizeChanges(
        graph,
        frame.id,
        { width: from, height: 100 },
        { width: to, height: 100 },
        originals
      )
      for (const [id, change] of changes) graph.updateNode(id, change)
    }
    const node = () => graph.getNode(vector.id) ?? vector
    return { graph, frame, resize, node }
  }

  test('a path keeps its shape when its width would reach zero', () => {
    const { resize, node } = stretched()
    resize(100, 80)
    resize(80, 100)
    expect(node()).toMatchObject({ x: 10, width: 40, flipX: false })
    expect(node().vectorNetwork?.vertices[1]).toEqual({ x: 40, y: 16 })
  })

  test('a drag back to the starting size puts the path back as it started', () => {
    const { graph, frame, resize, node } = stretched()
    const originals = collectResizeDescendants(graph, frame.id)
    resize(100, 200, originals)
    resize(100, 100, originals)
    expect(node()).toMatchObject({ x: 10, width: 20 })
    expect(node().vectorNetwork?.vertices[1]).toEqual({ x: 20, y: 16 })
  })

  test('a flat line back at its length takes its path back, whatever its flat side became', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, { width: 100, height: 100 })
    const line = graph.createNode('VECTOR', frame.id, {
      x: 10,
      y: 10,
      width: 10,
      height: 0,
      horizontalConstraint: 'STRETCH',
      verticalConstraint: 'STRETCH',
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 }
        ],
        segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: []
      }
    })
    const originals = collectResizeDescendants(graph, frame.id)
    if (!originals) throw new Error('Expected the line')
    const resize = (width: number, height: number) => {
      graph.updateNode(frame.id, { width, height })
      const before = { width: 100, height: 100 }
      const changes = computeConstrainedResizeChanges(
        graph,
        frame.id,
        before,
        { width, height },
        originals
      )
      for (const [id, change] of changes) graph.updateNode(id, change)
    }
    resize(110, 110)
    resize(100, 120)
    const node = graph.getNode(line.id)
    expect(node).toMatchObject({ width: 10, height: 20 })
    expect(node?.vectorNetwork?.vertices[1]).toEqual({ x: 10, y: 0 })
  })

  test('a drag turns the layer over once, from where it started', () => {
    const { graph, frame, resize, node } = stretched()
    const originals = collectResizeDescendants(graph, frame.id)
    // Each frame of a drag places the layers from the snapshot taken as it began.
    resize(100, 70, originals)
    resize(100, 60, originals)
    expect(node()).toMatchObject({ x: -10, width: 20, flipX: true })
    resize(100, 120, originals)
    expect(node()).toMatchObject({ x: 10, width: 40, flipX: false })
  })
})

describe('saved stroke outlines through a resize', () => {
  const outline = { windingRule: 'NONZERO' as const, commandsBlob: new Uint8Array([0]) }
  const vector = (segments: number) => ({
    type: 'VECTOR' as const,
    vectorNetwork: {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      segments: Array.from({ length: segments }, () => ({
        start: 0,
        end: 1,
        tangentStart: { x: 0, y: 0 },
        tangentEnd: { x: 0, y: 0 }
      })),
      regions: []
    },
    fillGeometry: [],
    strokeGeometry: [outline],
    derivedTextGlyphs: null,
    strokes: [],
    textPathData: null,
    textPathBox: null
  })

  test('go where a path can draw the stroke again, and stay where only the outline can', () => {
    expect(scaledGeometryChanges(vector(1), 10, 10, 20, 10).strokeGeometry).toEqual([])
    expect(scaledGeometryChanges(vector(0), 10, 10, 20, 10).strokeGeometry).toHaveLength(1)
  })

  test('a flat line scales along its length, its zero side left as it is', () => {
    const vertices = scaledGeometryChanges(vector(1), 10, 0, 30, 0).vectorNetwork?.vertices
    expect(vertices?.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 0, y: 0 },
      { x: 30, y: 0 }
    ])
  })
})

// Live Figma, 2026-11-08: a group in a 300×220 frame holds a 40×30 layer at 60,50 and a 30×30 one
// at 160,100. The group owns no constraints; each layer keeps its place in the frame by its own.
describe('layers in groups through a frame resize', () => {
  function grouped(kind: 'GROUP' | 'BOOLEAN_OPERATION' = 'GROUP') {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, { width: 300, height: 220 })
    const group = graph.createNode(kind, frame.id, { x: 60, y: 50, width: 130, height: 80 })
    const a = graph.createNode('RECTANGLE', group.id, { x: 0, y: 0, width: 40, height: 30 })
    const b = graph.createNode('RECTANGLE', group.id, { x: 100, y: 50, width: 30, height: 30 })
    let size = { width: 300, height: 220 }
    const resize = (width: number, height: number) => {
      const originals = collectResizeDescendants(graph, frame.id)
      if (!originals) throw new Error('Expected the group')
      graph.updateNode(frame.id, { width, height })
      const changes = computeConstrainedResizeChanges(
        graph,
        frame.id,
        size,
        { width, height },
        originals
      )
      for (const [id, change] of changes) graph.updateNode(id, change)
      size = { width, height }
    }
    /** A layer's box in the frame, through the groups holding it. */
    const inFrame = (id: string) => {
      const node = graph.getNode(id)
      if (!node) throw new Error(`Expected ${id}`)
      let { x, y } = node
      for (let p = graph.getNode(node.parentId ?? ''); p && p.id !== frame.id;) {
        x += p.x
        y += p.y
        p = graph.getNode(p.parentId ?? '')
      }
      const round = (n: number) => Math.round(n * 100) / 100
      return [round(x), round(y), round(node.width), round(node.height)]
    }
    return { graph, frame, group, a, b, resize, inFrame }
  }

  test('each layer follows its own constraints and the group fits around them', () => {
    const { graph, group, a, b, resize, inFrame } = grouped()
    graph.updateNode(a.id, { horizontalConstraint: 'MAX', verticalConstraint: 'MAX' })
    resize(400, 300)
    expect(inFrame(a.id)).toEqual([160, 130, 40, 30])
    expect(inFrame(b.id)).toEqual([160, 100, 30, 30])
    expect(inFrame(group.id)).toEqual([160, 100, 40, 60])
    resize(250, 180)
    expect(inFrame(a.id)).toEqual([10, 10, 40, 30])
    expect(inFrame(group.id)).toEqual([10, 10, 180, 120])
  })

  test('Left & right, Center, and Scale work in the frame, not the group', () => {
    const stretch = grouped()
    stretch.graph.updateNode(stretch.a.id, {
      horizontalConstraint: 'STRETCH',
      verticalConstraint: 'STRETCH'
    })
    stretch.graph.updateNode(stretch.b.id, {
      horizontalConstraint: 'CENTER',
      verticalConstraint: 'CENTER'
    })
    stretch.resize(400, 300)
    expect(stretch.inFrame(stretch.a.id)).toEqual([60, 50, 140, 110])
    expect(stretch.inFrame(stretch.b.id)).toEqual([210, 140, 30, 30])
    expect(stretch.inFrame(stretch.group.id)).toEqual([60, 50, 180, 120])
    stretch.resize(250, 180)
    expect(stretch.inFrame(stretch.a.id)).toEqual([50, 40, 10, 10])
    expect(stretch.graph.getNode(stretch.a.id)).toMatchObject({ flipX: true, flipY: true })
    expect(stretch.inFrame(stretch.group.id)).toEqual([50, 40, 115, 70])

    const scale = grouped()
    for (const layer of [scale.a, scale.b]) {
      scale.graph.updateNode(layer.id, {
        horizontalConstraint: 'SCALE',
        verticalConstraint: 'SCALE'
      })
    }
    scale.resize(400, 300)
    expect(scale.inFrame(scale.a.id)).toEqual([80, 68.18, 53.33, 40.91])
    expect(scale.inFrame(scale.b.id)).toEqual([213.33, 136.36, 40, 40.91])
    expect(scale.inFrame(scale.group.id)).toEqual([80, 68.18, 173.33, 109.09])
  })

  test('a layer in a nested group pins to the frame, and both groups fit', () => {
    const { graph, frame, group, resize, inFrame } = grouped()
    const inner = graph.createNode('GROUP', group.id, { x: 80, y: 110, width: 80, height: 30 })
    graph.updateNode(group.id, { height: 140 })
    const c = graph.createNode('RECTANGLE', inner.id, {
      x: 40,
      y: 0,
      width: 20,
      height: 20,
      horizontalConstraint: 'MAX',
      verticalConstraint: 'MAX'
    })
    graph.createNode('RECTANGLE', inner.id, { x: 0, y: 10, width: 20, height: 20 })
    expect(inFrame(c.id)).toEqual([180, 160, 20, 20])
    resize(400, 300)
    expect(inFrame(c.id)).toEqual([280, 240, 20, 20])
    expect(inFrame(inner.id)).toEqual([140, 170, 160, 90])
    expect(inFrame(group.id)).toEqual([60, 50, 240, 210])
    expect(graph.getNode(frame.id)).toMatchObject({ width: 400, height: 300 })
  })

  test("a boolean's operands pin to the frame too", () => {
    const { graph, group, a, resize, inFrame } = grouped('BOOLEAN_OPERATION')
    graph.updateNode(a.id, { horizontalConstraint: 'MAX', verticalConstraint: 'MAX' })
    resize(400, 300)
    expect(inFrame(a.id)).toEqual([160, 130, 40, 30])
    expect(inFrame(group.id)).toEqual([160, 100, 40, 60])
  })

  test('a drag places from where it began, so the group comes back with its layers', () => {
    const { graph, frame, group, a, inFrame } = grouped()
    graph.updateNode(a.id, { horizontalConstraint: 'MAX' })
    const originals = collectResizeDescendants(graph, frame.id)
    if (!originals) throw new Error('Expected the group')
    const dragTo = (width: number) => {
      graph.updateNode(frame.id, { width })
      const before = { width: 300, height: 220 }
      const changes = computeConstrainedResizeChanges(
        graph,
        frame.id,
        before,
        { width, height: 220 },
        originals
      )
      for (const [id, change] of changes) graph.updateNode(id, change)
    }
    dragTo(400)
    expect(inFrame(group.id)).toEqual([160, 50, 40, 80])
    dragTo(300)
    expect(inFrame(group.id)).toEqual([60, 50, 130, 80])
    expect(inFrame(a.id)).toEqual([60, 50, 40, 30])
  })
})

describe('a boolean in a resized frame', () => {
  test('keeps its box when no operand moves, as only the renderer measures its result', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, { width: 300, height: 220 })
    // A subtraction whose result is smaller than its operands' bounds.
    const boolean = graph.createNode('BOOLEAN_OPERATION', frame.id, {
      x: 40,
      y: 40,
      width: 30,
      height: 60,
      booleanOperation: 'SUBTRACT'
    })
    graph.createNode('RECTANGLE', boolean.id, { width: 60, height: 60 })
    graph.createNode('RECTANGLE', boolean.id, { x: 30, width: 30, height: 60 })
    const originals = collectResizeDescendants(graph, frame.id)
    if (!originals) throw new Error('Expected the boolean')
    const changes = computeConstrainedResizeChanges(
      graph,
      frame.id,
      { width: 300, height: 220 },
      { width: 400, height: 300 },
      originals
    )
    expect(changes.get(boolean.id)).toEqual({ x: 40, y: 40, width: 30, height: 60 })
  })
})
