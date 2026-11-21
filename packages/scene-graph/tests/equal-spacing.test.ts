import { describe, expect, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { computeSpacingSnap } from '@open-pencil/scene-graph/equal-spacing'
import type { Rect } from '@open-pencil/scene-graph/primitives'

const THRESHOLD = 5

function boxes(...rects: Rect[]): SceneNode[] {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  if (!page) throw new Error('Expected a page')
  return rects.map((rect) => graph.createNode('RECTANGLE', page.id, rect))
}

const box = (x: number, y = 0, width = 40, height = 40): Rect => ({ x, y, width, height })

describe('equal spacing', () => {
  // A row with a 20 px gap between its first two boxes.
  const row = () => boxes(box(0), box(60), box(200))

  test('a box beside its neighbor lands one existing gap from it', () => {
    const result = computeSpacingSnap(new Set(), box(122), row(), THRESHOLD)
    expect(result.x?.delta).toBe(-2)
    expect(result.x?.guides).toEqual([
      { axis: 'x', position: 20, from: 100, to: 120, spacing: 20 },
      { axis: 'x', position: 20, from: 40, to: 60, spacing: 20 }
    ])
    expect(result.y).toBeNull()
  })

  test('a box between two neighbors centers between them', () => {
    // The gap from 100 to 200 holds the 40 px box with 30 px on each side.
    const result = computeSpacingSnap(new Set(), box(132), boxes(box(60), box(200)), THRESHOLD)
    expect(result.x?.delta).toBe(-2)
    expect(result.x?.guides.map((guide) => guide.spacing)).toEqual([30, 30])
  })

  test('a box out of reach of every gap does not snap', () => {
    expect(computeSpacingSnap(new Set(), box(150), row(), THRESHOLD).x).toBeNull()
  })

  test('only layers across from the box count as its row', () => {
    const layers = boxes(box(0), box(60), box(200, 300))
    expect(computeSpacingSnap(new Set(), box(122), layers, THRESHOLD).x?.delta).toBe(-2)
    const elsewhere = boxes(box(0, 300), box(60, 300), box(200, 300))
    expect(computeSpacingSnap(new Set(), box(122), elsewhere, THRESHOLD).x).toBeNull()
  })

  test('a column matches gaps vertically', () => {
    const column = boxes(box(0, 0), box(0, 50))
    const result = computeSpacingSnap(new Set(), box(0, 103), column, THRESHOLD)
    expect(result.y?.delta).toBe(-3)
    expect(result.y?.guides.map((guide) => guide.spacing)).toEqual([10, 10])
  })

  test('the frame around the box is no neighbor, and the moving layers are skipped', () => {
    const [frame, first, second, moving] = boxes(box(-50, -50, 400, 200), box(0), box(60), box(122))
    const ids = new Set([moving?.id ?? ''])
    const layers = [frame, first, second, moving].flatMap((node) => (node ? [node] : []))
    expect(computeSpacingSnap(ids, box(122), layers, THRESHOLD).x?.delta).toBe(-2)
  })
})
