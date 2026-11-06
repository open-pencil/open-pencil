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
    expect(constrainedChildRect(child, frame, { width: 80, height: 100 }, 'STRETCH', 'MIN')).toEqual(
      child
    )
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
        segments: [
          { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        regions: []
      }
    })
    const resize = (from: number, to: number, originals = collectResizeDescendants(graph, frame.id)) => {
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
})
