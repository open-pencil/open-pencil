import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor, type MoveChange } from '@open-pencil/core'
import { getNodeOrThrow } from '@open-pencil/test-support/assert'

let editor: Editor

afterEach(() => editor.dispose())

function setup() {
  editor = createEditor()
  const rect = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
    x: 0,
    y: 0,
    width: 40,
    height: 40
  })
  editor.select([rect.id])
  // Moves stay on the line y = 0, and never left of 0.
  const seen: MoveChange[] = []
  editor.setMovePolicy((change) => {
    seen.push(change)
    return { x: Math.max(0, change.to.x ?? change.node.x), y: 0 }
  })
  return { rect, seen }
}

describe('a move policy', () => {
  test('decides where nudges and position edits put a layer; other fields pass as they are', () => {
    const { rect, seen } = setup()
    editor.nudgeSelected(-10, 10)
    editor.flushNudge()
    expect(getNodeOrThrow(editor.graph, rect.id)).toMatchObject({ x: 0, y: 0 })

    editor.updateNode(rect.id, { x: 30, y: 25, opacity: 0.5 })
    expect(getNodeOrThrow(editor.graph, rect.id)).toMatchObject({ x: 30, y: 0, opacity: 0.5 })
    editor.updateNodeWithUndo(rect.id, { y: 3, fills: [] })
    expect(getNodeOrThrow(editor.graph, rect.id)).toMatchObject({ x: 30, y: 0, fills: [] })
    expect(seen.at(-1)).toMatchObject({ to: { y: 3 }, preview: false })
  })

  test('a resize or a rotation landing is not a move: it places the layer as it worked it out', () => {
    const { rect, seen } = setup()
    const asked = seen.length
    // A top-edge resize lands with a new y and height together.
    editor.updateNode(rect.id, { y: -20, height: 60 })
    expect(getNodeOrThrow(editor.graph, rect.id)).toMatchObject({ y: -20, height: 60 })
    editor.updateNodeWithUndo(rect.id, { x: 12, y: 8, rotation: 30 })
    expect(getNodeOrThrow(editor.graph, rect.id)).toMatchObject({ x: 12, y: 8, rotation: 30 })
    expect(seen).toHaveLength(asked)
  })

  test('a refused move leaves the layer where it is, and other fields still change', () => {
    const { rect } = setup()
    editor.setMovePolicy(() => null)
    editor.updateNode(rect.id, { x: 30, opacity: 0.5 })
    expect(getNodeOrThrow(editor.graph, rect.id)).toMatchObject({ x: 0, opacity: 0.5 })
  })

  test("leaves the host's own edits and undo alone", () => {
    const { rect } = setup()
    editor.asHost(() => editor.updateNode(rect.id, { y: 50 }))
    expect(getNodeOrThrow(editor.graph, rect.id).y).toBe(50)

    editor.setMovePolicy(null)
    editor.updateNodeWithUndo(rect.id, { y: 70 })
    editor.setMovePolicy(() => ({ y: 0 }))
    editor.undoAction()
    expect(getNodeOrThrow(editor.graph, rect.id).y).toBe(50)
  })
})
