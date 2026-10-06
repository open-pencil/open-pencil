import { describe, expect, test } from 'bun:test'

import { TRANSPARENT } from '@open-pencil/core/constants'
import { createEditor } from '@open-pencil/core/editor'
import { getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'

describe('booleanOperationSelected', () => {
  test('wraps selected nodes in a boolean operation container', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('RECTANGLE', pageId, {
      x: 10,
      y: 20,
      width: 30,
      height: 40
    })
    const second = editor.graph.createNode('ELLIPSE', pageId, {
      x: 80,
      y: 90,
      width: 20,
      height: 10
    })

    editor.select([first.id, second.id])
    editor.booleanOperationSelected('UNION')

    const [booleanId] = [...editor.state.selectedIds]
    const booleanNode = editor.graph.getNode(booleanId)
    expect(booleanNode?.type).toBe('BOOLEAN_OPERATION')
    expect(booleanNode?.booleanOperation).toBe('UNION')
    expect(booleanNode?.fills).toEqual(first.fills)
    expect(booleanNode?.childIds).toEqual([first.id, second.id])
    expect(editor.graph.getNode(first.id)?.parentId).toBe(booleanId)
    expect(editor.graph.getNode(second.id)?.parentId).toBe(booleanId)
  })

  test('does not wrap unsupported text nodes', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('TEXT', pageId, {
      text: 'Nope',
      fontFamily: 'Definitely Missing Font'
    })
    const second = editor.graph.createNode('RECTANGLE', pageId)

    editor.select([first.id, second.id])
    const result = editor.booleanOperationSelected('UNION')

    expect(result).toBeNull()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([first.id, second.id])
    expect(editor.state.selectedIds).toEqual(new Set([first.id, second.id]))
  })

  test('does not wrap complex script text without shaping support', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('TEXT', pageId, {
      text: 'مرحبا',
      fontFamily: 'Inter'
    })
    const second = editor.graph.createNode('RECTANGLE', pageId)

    editor.select([first.id, second.id])
    const result = editor.booleanOperationSelected('UNION')

    expect(result).toBeNull()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([first.id, second.id])
  })

  test('does not wrap visible image fills', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('RECTANGLE', pageId, {
      fills: [
        {
          type: 'IMAGE',
          imageHash: 'image',
          imageScaleMode: 'FILL',
          color: TRANSPARENT,
          opacity: 1,
          visible: true
        }
      ]
    })
    const second = editor.graph.createNode('RECTANGLE', pageId)

    editor.select([first.id, second.id])
    const result = editor.booleanOperationSelected('UNION')

    expect(result).toBeNull()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([first.id, second.id])
  })

  test('undo and redo preserve parent order and selection', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const before = editor.graph.createNode('RECTANGLE', pageId, { name: 'Before' })
    const first = editor.graph.createNode('RECTANGLE', pageId, { name: 'First' })
    const second = editor.graph.createNode('ELLIPSE', pageId, { name: 'Second' })
    const after = editor.graph.createNode('RECTANGLE', pageId, { name: 'After' })

    editor.select([first.id, second.id])
    editor.booleanOperationSelected('EXCLUDE')
    const [booleanId] = [...editor.state.selectedIds]
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([before.id, booleanId, after.id])

    editor.undo.undo()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([
      before.id,
      first.id,
      second.id,
      after.id
    ])
    expect(editor.state.selectedIds).toEqual(new Set([first.id, second.id]))

    editor.undo.redo()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([before.id, booleanId, after.id])
    expect(editor.graph.getNode(booleanId)?.booleanOperation).toBe('EXCLUDE')
    expect(editor.state.selectedIds).toEqual(new Set([booleanId]))
  })
})

describe('container placement inside a rotated frame', () => {
  function rotatedFrameWithChildren() {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, {
      x: 100,
      y: 200,
      width: 300,
      height: 300,
      rotation: 90
    })
    const first = editor.graph.createNode('RECTANGLE', frame.id, {
      x: 10,
      y: 20,
      width: 30,
      height: 30
    })
    const second = editor.graph.createNode('RECTANGLE', frame.id, {
      x: 60,
      y: 70,
      width: 20,
      height: 20
    })
    const before = [first, second].map((node) => getAxisAlignedWorldBounds(node, editor.graph))
    return { editor, frame, first, second, before }
  }

  function expectContainerInFrameAxes(editor: ReturnType<typeof createEditor>, id: string) {
    const container = editor.graph.getNode(id)
    expect(container?.x).toBeCloseTo(10, 6)
    expect(container?.y).toBeCloseTo(20, 6)
    expect(container?.width).toBeCloseTo(70, 6)
    expect(container?.height).toBeCloseTo(70, 6)
  }

  test('a boolean operation sits in the frame axes and keeps its operands where drawn', () => {
    const { editor, first, second, before } = rotatedFrameWithChildren()
    editor.select([first.id, second.id])
    editor.booleanOperationSelected('UNION')

    const [booleanId] = [...editor.state.selectedIds]
    expectContainerInFrameAxes(editor, booleanId)
    const after = [first, second].map((node) => getAxisAlignedWorldBounds(node, editor.graph))
    for (const [index, bounds] of after.entries()) {
      expect(bounds.x).toBeCloseTo(before[index].x, 6)
      expect(bounds.y).toBeCloseTo(before[index].y, 6)
    }
  })

  test('a group sits in the frame axes and keeps its children where drawn', () => {
    const { editor, first, second, before } = rotatedFrameWithChildren()
    editor.select([first.id, second.id])
    editor.groupSelected()

    const [groupId] = [...editor.state.selectedIds]
    expect(editor.graph.getNode(groupId)?.type).toBe('GROUP')
    expectContainerInFrameAxes(editor, groupId)
    const after = [first, second].map((node) => getAxisAlignedWorldBounds(node, editor.graph))
    for (const [index, bounds] of after.entries()) {
      expect(bounds.x).toBeCloseTo(before[index].x, 6)
      expect(bounds.y).toBeCloseTo(before[index].y, 6)
    }
  })
})
