import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor, type MoveChange } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
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
  test('decides where nudges put a layer', () => {
    const { rect, seen } = setup()
    editor.nudgeSelected(-10, 10)
    editor.flushNudge()
    expect(getNodeOrThrow(editor.graph, rect.id)).toMatchObject({ x: 0, y: 0 })
    expect(seen.at(-1)).toMatchObject({ to: { x: -10, y: 10 }, preview: false })
  })

  test('decides the position of a move a front end asks about, and leaves its other fields', () => {
    const { rect } = setup()
    const node = getNodeOrThrow(editor.graph, rect.id)
    expect(editor.constrainMove(node, { x: 30, y: 25, opacity: 0.5 })).toEqual({
      x: 30,
      y: 0,
      opacity: 0.5
    })
    expect(editor.constrainMove<Partial<SceneNode>>(node, { x: -5 }, { preview: true })).toEqual({
      x: 0,
      y: 0
    })
  })

  test('a refused move leaves the position out, and other fields stay', () => {
    const { rect } = setup()
    editor.setMovePolicy(() => null)
    const node = getNodeOrThrow(editor.graph, rect.id)
    expect(editor.constrainMove<Partial<SceneNode>>(node, { x: 30, opacity: 0.5 })).toEqual({
      opacity: 0.5
    })
  })

  test('leaves edits that are not moves, such as a resize landing, to their own call', () => {
    const { rect, seen } = setup()
    const asked = seen.length
    // A top-edge resize lands its new y and height through updateNode.
    editor.updateNode(rect.id, { y: -20, height: 60 })
    expect(getNodeOrThrow(editor.graph, rect.id)).toMatchObject({ y: -20, height: 60 })
    expect(seen).toHaveLength(asked)
  })

  test("leaves the host's own edits and undo alone", () => {
    const { rect } = setup()
    editor.asHost(() => {
      editor.nudgeSelected(0, 50)
      editor.flushNudge()
    })
    expect(getNodeOrThrow(editor.graph, rect.id).y).toBe(50)

    editor.setMovePolicy(null)
    editor.nudgeSelected(0, 20)
    editor.flushNudge()
    editor.setMovePolicy(() => ({ y: 0 }))
    editor.undoAction()
    expect(getNodeOrThrow(editor.graph, rect.id).y).toBe(50)
  })
})
