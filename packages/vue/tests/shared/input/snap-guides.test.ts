import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'
import { computeSnap } from '@open-pencil/scene-graph/snap'

import { applyResizeSnap } from '#vue/shared/input/resize/snap'
import { computePixelGridSnap, resolveObjectPixelSnap } from '#vue/shared/input/snap'

describe('move snap guide presentation', () => {
  // Figma desktop 126 ends a move on whole pixels at any zoom, even from a fractional start.
  test('pixel rounding applies however far zoomed in', () => {
    const editor = createEditor()
    editor.state.snappingPreferences = { geometry: false, objects: true, pixelGrid: true }
    editor.state.zoom = 16
    const result = resolveObjectPixelSnap(
      new Set(['frame']),
      { x: 10.4, y: 20.6, width: 100, height: 80 },
      [],
      editor
    )
    expect(result.correction.x).toBeCloseTo(-0.4)
    expect(result.correction.y).toBeCloseTo(0.4)
  })

  // FigJam ends a move with the top-left on the board's 16-unit dot grid.
  test('a board rounds a move to its 16-unit grid', () => {
    const editor = createEditor()
    editor.setDocumentKind('board')
    editor.state.snappingPreferences = { geometry: false, objects: true, pixelGrid: true }
    const result = resolveObjectPixelSnap(
      new Set(['sticky']),
      { x: 10.4, y: 41, width: 240, height: 240 },
      [],
      editor
    )
    expect(result.correction.x).toBeCloseTo(5.6)
    expect(result.correction.y).toBeCloseTo(7)
  })

  test('pixel rounding adjusts a lone frame without drawing self-alignment guides', () => {
    const pixel = computePixelGridSnap({ x: 10.25, y: 20.4, width: 100, height: 80 })
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

  test('a resize shows only the guides of the axes its handle moves', () => {
    const editor = createEditor()
    editor.state.snappingPreferences = { geometry: false, objects: true, pixelGrid: true }
    const pageId = editor.state.currentPageId
    const box = editor.graph.createNode('FRAME', pageId, { x: 0, y: 20, width: 100, height: 80 })
    editor.graph.createNode('FRAME', pageId, { x: 150, y: 20, width: 100, height: 80 })
    const rect = applyResizeSnap(
      { nodeId: box.id, handle: 'e' },
      { x: 0, y: 20, width: 148, height: 80 },
      editor,
      false
    )
    expect(rect.width).toBe(150)
    expect(editor.state.snapGuides.map((guide) => guide.axis)).not.toContain('y')
    expect(editor.state.snapGuides.length).toBeGreaterThan(0)
  })

  test('multiple moving nodes are excluded from object targets', () => {
    const nodes = [
      createDefaultNode(() => 'first', 'FRAME', { x: 0, y: 0, width: 50, height: 50, rotation: 0 }),
      createDefaultNode(() => 'second', 'FRAME', {
        x: 50,
        y: 0,
        width: 50,
        height: 50,
        rotation: 0
      })
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
