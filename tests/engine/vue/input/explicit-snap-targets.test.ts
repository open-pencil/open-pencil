import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import { explicitSnapTargets } from '#vue/shared/input/explicit-snap-targets'
import { resolveObjectPixelSnap } from '#vue/shared/input/snap'

function pageWithGuide(offset: number, axis: 'X' | 'Y') {
  const editor = createEditor()
  const page = editor.graph.getNode(editor.state.currentPageId)
  if (!page) throw new Error('Page not found')
  page.guides = [{ axis: axis === 'X' ? 'x' : 'y', position: offset }]
  return editor
}

describe('explicit snap targets', () => {
  test('canvas guides outrank object and pixel targets', () => {
    const editor = pageWithGuide(102.5, 'X')
    const pageId = editor.state.currentPageId
    const target = editor.graph.createNode('RECTANGLE', pageId, {
      x: 103,
      y: 0,
      width: 50,
      height: 50
    })

    const result = resolveObjectPixelSnap(
      new Set(['moving']),
      { x: 100, y: 10, width: 10, height: 10 },
      [target],
      editor,
      explicitSnapTargets(pageId, editor)
    )

    expect(result.correction.x).toBe(2.5)
    expect(result.guides[0]).toMatchObject({ kind: 'canvas-guide', position: 102.5 })
  })

  test('geometry targets outrank canvas guides, objects, and pixels', () => {
    const editor = pageWithGuide(102.5, 'X')
    const pageId = editor.state.currentPageId
    const target = editor.graph.createNode('RECTANGLE', pageId, {
      x: 103,
      y: 0,
      width: 50,
      height: 50
    })

    const result = resolveObjectPixelSnap(
      new Set(['moving']),
      { x: 100, y: 10, width: 10, height: 10 },
      [target],
      editor,
      explicitSnapTargets(pageId, editor),
      [{ kind: 'geometry', axis: 'x', position: 101.5, from: 20, to: 20 }]
    )

    expect(result.correction.x).toBe(1.5)
    expect(result.guides[0]).toEqual({
      kind: 'geometry',
      axis: 'x',
      position: 101.5,
      from: 20,
      to: 20
    })
    expect(result.guides.filter((guide) => guide.axis === 'x')).toHaveLength(1)
  })

  test('emits one stable guide for coincident explicit targets', () => {
    const editor = createEditor()
    editor.state.snappingPreferences = { geometry: false, objects: false, pixelGrid: false }
    const result = resolveObjectPixelSnap(
      new Set(['moving']),
      { x: 99, y: 10, width: 10, height: 10 },
      [],
      editor,
      [
        { kind: 'canvas-guide', axis: 'x', position: 100, from: 0, to: 20 },
        { kind: 'layout-guide', axis: 'x', position: 100, from: 10, to: 30 }
      ]
    )

    expect(result.guides).toEqual([
      { kind: 'canvas-guide', axis: 'x', position: 100, from: 0, to: 20 }
    ])
    expect(
      resolveObjectPixelSnap(
        new Set(['moving']),
        { x: 99, y: 10, width: 10, height: 10 },
        [],
        editor,
        [
          { kind: 'canvas-guide', axis: 'x', position: 100, from: 0, to: 20 },
          { kind: 'layout-guide', axis: 'x', position: 100, from: 10, to: 30 }
        ]
      ).guides
    ).toEqual(result.guides)
  })

  test('extracts visible layout-guide boundaries in world space', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, {
      x: 100,
      y: 200,
      width: 300,
      height: 200,
      layoutGrids: [
        {
          pattern: 'COLUMNS',
          alignment: 'STRETCH',
          count: 2,
          offset: 20,
          gutterSize: 10
        }
      ]
    })

    expect(explicitSnapTargets(frame.id, editor)).toEqual(
      expect.arrayContaining([
        { kind: 'layout-guide', axis: 'x', position: 120, from: 200, to: 400 },
        { kind: 'layout-guide', axis: 'x', position: 245, from: 200, to: 400 },
        { kind: 'layout-guide', axis: 'x', position: 255, from: 200, to: 400 },
        { kind: 'layout-guide', axis: 'x', position: 380, from: 200, to: 400 }
      ])
    )
  })

  test('ignores layout guides rotated away from the canvas axes', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, {
      x: 100,
      y: 200,
      width: 300,
      height: 200,
      rotation: 30,
      layoutGrids: [{ pattern: 'COLUMNS', sectionSize: 50, count: 2 }]
    })

    expect(explicitSnapTargets(frame.id, editor)).toEqual([])
  })

  test('ignores hidden layout guides', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, {
      width: 300,
      height: 200,
      layoutGrids: [{ pattern: 'GRID', sectionSize: 10, visible: false }]
    })

    expect(explicitSnapTargets(frame.id, editor)).toEqual([])
  })
})
