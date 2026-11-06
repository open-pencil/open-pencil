import { describe, expect, test } from 'bun:test'

import type { ConstraintType } from '@open-pencil/scene-graph'
import {
  constrainedChildRect,
  isConstraintEligible,
  scaledGeometryChanges
} from '@open-pencil/scene-graph/resize'
import { createRect, firstPageId, makeSceneGraph } from '@open-pencil/test-support/scene'

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

describe('which layers follow constraints', () => {
  test('frame children outside auto layout flow, but not groups, top-level layers, or section children', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const topLevel = createRect(graph, pageId)
    const frame = graph.createNode('FRAME', pageId, { layoutMode: 'NONE' })
    const child = createRect(graph, frame.id)
    const group = graph.createNode('GROUP', frame.id)
    const section = graph.createNode('SECTION', pageId)
    const inSection = createRect(graph, section.id)
    expect(isConstraintEligible(graph, topLevel)).toBe(false)
    expect(isConstraintEligible(graph, child)).toBe(true)
    expect(isConstraintEligible(graph, group)).toBe(false)
    expect(isConstraintEligible(graph, inSection)).toBe(false)

    graph.updateNode(frame.id, { layoutMode: 'HORIZONTAL' })
    expect(isConstraintEligible(graph, child)).toBe(false)
    graph.updateNode(child.id, { layoutPositioning: 'ABSOLUTE' })
    expect(isConstraintEligible(graph, child)).toBe(true)
  })
})
