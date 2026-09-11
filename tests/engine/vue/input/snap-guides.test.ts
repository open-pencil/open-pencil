import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { computeSnap } from '@open-pencil/scene-graph'

import { computePixelGridSnap, resolveObjectPixelSnap } from '#vue/shared/input/snap'

describe('move snap guide presentation', () => {
  test('pixel rounding adjusts a lone frame without drawing self-alignment guides', () => {
    const pixel = computePixelGridSnap({ x: 10.25, y: 20.4, width: 100, height: 80 }, 5)
    expect(pixel.delta).toEqual({ x: -0.25, y: -0.3999999999999986 })
    expect(pixel.guides).toEqual([])
    const editor = createEditor()
    editor.state.snappingPreferences = { geometry: false, objects: true, pixelGrid: true }
    const result = resolveObjectPixelSnap(
      new Set(['frame']),
      { x: 10.25, y: 20.4, width: 100, height: 80 },
      [],
      editor
    )
    expect(result.correction).toEqual(pixel.delta)
    expect(result.guides).toEqual([])
  })

  test('object alignment still emits a real guide', () => {
    const editor = createEditor()
    editor.state.snappingPreferences = { geometry: false, objects: true, pixelGrid: true }
    const target = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      x: 200,
      y: 20,
      width: 100,
      height: 80
    })
    const result = resolveObjectPixelSnap(
      new Set(['moving']),
      { x: 99, y: 20, width: 100, height: 80 },
      [target],
      editor
    )
    expect(result.correction.x).toBe(1)
    expect(result.guides.some((guide) => guide.axis === 'x' && guide.position === 200)).toBe(true)
  })

  test('multiple moving nodes are excluded from object targets', () => {
    const nodes = [
      { id: 'first', x: 0, y: 0, width: 50, height: 50, rotation: 0 },
      { id: 'second', x: 50, y: 0, width: 50, height: 50, rotation: 0 }
    ]
    expect(
      computeSnap(
        new Set(['first', 'second']),
        { x: 0.2, y: 0.2, width: 100, height: 50 },
        nodes,
        5
      ).guides
    ).toEqual([])
  })
})
