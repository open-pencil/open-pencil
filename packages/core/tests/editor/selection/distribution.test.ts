import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { getAbsolutePositionFull } from '@open-pencil/scene-graph/coordinate'

function positions(editor: ReturnType<typeof createEditor>, ids: string[], axis: 'x' | 'y') {
  return ids.map((id) => editor.graph.getNode(id)?.[axis])
}

describe('distribute nodes', () => {
  test('distributes horizontal spacing while preserving outer bounds', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('RECTANGLE', pageId, { x: 0, width: 10, height: 10 })
    const middle = editor.graph.createNode('RECTANGLE', pageId, { x: 80, width: 20, height: 10 })
    const last = editor.graph.createNode('RECTANGLE', pageId, { x: 130, width: 30, height: 10 })

    editor.distributeNodes([first.id, middle.id, last.id], 'horizontal')

    expect(positions(editor, [first.id, middle.id, last.id], 'x')).toEqual([0, 60, 130])
  })

  test('sorts nodes geometrically before distributing vertical spacing', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const bottom = editor.graph.createNode('RECTANGLE', pageId, { y: 100, width: 10, height: 20 })
    const top = editor.graph.createNode('RECTANGLE', pageId, { y: 0, width: 10, height: 10 })
    const middle = editor.graph.createNode('RECTANGLE', pageId, { y: 70, width: 10, height: 10 })

    editor.distributeNodes([bottom.id, top.id, middle.id], 'vertical')

    expect(positions(editor, [top.id, middle.id, bottom.id], 'y')).toEqual([0, 50, 100])
  })

  test('distributes in world space inside a rotated parent', () => {
    const editor = createEditor()
    const parent = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      x: 200,
      y: 100,
      width: 200,
      height: 200,
      rotation: 90
    })
    const first = editor.graph.createNode('RECTANGLE', parent.id, {
      x: 0,
      y: 0,
      width: 10,
      height: 10
    })
    const middle = editor.graph.createNode('RECTANGLE', parent.id, {
      x: 0,
      y: 80,
      width: 10,
      height: 20
    })
    const last = editor.graph.createNode('RECTANGLE', parent.id, {
      x: 0,
      y: 130,
      width: 10,
      height: 30
    })
    const nodes = [first, middle, last]
    const before = new Map(
      nodes.map((node) => [node.id, getAbsolutePositionFull(node, editor.graph)])
    )

    editor.distributeNodes(
      nodes.map((node) => node.id),
      'horizontal'
    )

    const after = nodes
      .map((node) => getAbsolutePositionFull(node, editor.graph))
      .sort((a, b) => a.boundX - b.boundX)
    const firstGap = after[1].boundX - (after[0].boundX + after[0].width)
    const secondGap = after[2].boundX - (after[1].boundX + after[1].width)
    expect(firstGap).toBeCloseTo(secondGap)
    for (const node of nodes) {
      expect(getAbsolutePositionFull(node, editor.graph).boundY).toBeCloseTo(
        before.get(node.id)?.boundY ?? 0
      )
    }
  })

  test('rejects normal auto-layout children but permits absolute children', () => {
    const editor = createEditor()
    const parent = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      layoutMode: 'HORIZONTAL'
    })
    const flowIds = [0, 1, 2].map(() => editor.graph.createNode('RECTANGLE', parent.id).id)

    expect(editor.canDistributeNodes(flowIds)).toBe(false)
    editor.distributeNodes(flowIds, 'horizontal')
    expect(editor.undo.canUndo).toBe(false)

    for (const id of flowIds) editor.graph.updateNode(id, { layoutPositioning: 'ABSOLUTE' })
    expect(editor.canDistributeNodes(flowIds)).toBe(true)
  })

  test('records distribution in undo history', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('RECTANGLE', pageId, { x: 0, width: 10, height: 10 })
    const middle = editor.graph.createNode('RECTANGLE', pageId, { x: 80, width: 20, height: 10 })
    const last = editor.graph.createNode('RECTANGLE', pageId, { x: 130, width: 30, height: 10 })
    const ids = [first.id, middle.id, last.id]

    editor.distributeNodes(ids, 'horizontal')
    expect(positions(editor, ids, 'x')).toEqual([0, 60, 130])

    editor.undoAction()
    expect(positions(editor, ids, 'x')).toEqual([0, 80, 130])

    editor.redoAction()
    expect(positions(editor, ids, 'x')).toEqual([0, 60, 130])
  })
})

// Figma desktop 126: Spacing reads the gaps of a row or column and typing a value spaces it from
// its first layer; layers apart on both axes have no spacing.
describe('selection spacing', () => {
  function row() {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const a = editor.graph.createNode('RECTANGLE', pageId, { x: 0, y: 180, width: 100, height: 80 })
    const b = editor.graph.createNode('RECTANGLE', pageId, { x: 140, y: 180, width: 120, height: 80 })
    const c = editor.graph.createNode('ELLIPSE', pageId, { x: 320, y: 180, width: 80, height: 80 })
    return { editor, ids: [c.id, a.id, b.id], a, b, c }
  }

  test('reads the gaps along a row in order', () => {
    const { editor, ids } = row()
    expect(editor.selectionSpacing(ids)).toEqual({ axis: 'horizontal', gaps: [40, 60] })
  })

  test('spaces the row from its first layer', () => {
    const { editor, ids, a, b, c } = row()
    editor.setSelectionSpacing(ids, 10)
    expect(positions(editor, [a.id, b.id, c.id], 'x')).toEqual([0, 110, 240])
    editor.undo.undo()
    expect(positions(editor, [a.id, b.id, c.id], 'x')).toEqual([0, 140, 320])
  })

  test('reads a column when the layers overlap across it', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const rect = editor.graph.createNode('RECTANGLE', pageId, { x: 0, y: 180, width: 100, height: 80 })
    const text = editor.graph.createNode('TEXT', pageId, { x: 0, y: 300, width: 39, height: 19 })
    expect(editor.selectionSpacing([text.id, rect.id])).toEqual({ axis: 'vertical', gaps: [40] })
  })

  test('has no spacing for layers apart on both axes', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const rect = editor.graph.createNode('RECTANGLE', pageId, { x: 110, y: 180, width: 120, height: 80 })
    const text = editor.graph.createNode('TEXT', pageId, { x: 0, y: 300, width: 39, height: 19 })
    expect(editor.selectionSpacing([text.id, rect.id])).toBeNull()
  })
})
