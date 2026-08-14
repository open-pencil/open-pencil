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
