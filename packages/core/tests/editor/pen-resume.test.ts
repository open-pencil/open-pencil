import { afterEach, describe, expect, test } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import { createEditor, type Editor } from '@open-pencil/core/editor'

let editor: Editor

afterEach(() => editor.dispose())

/** A 100-wide open path in a frame at (200, 100), named "Path". */
function setup() {
  editor = createEditor()
  const page = editor.state.currentPageId
  const frame = editor.graph.createNode('FRAME', page, { x: 200, y: 100, width: 300, height: 300 })
  const path = editor.graph.createNode('VECTOR', frame.id, {
    name: 'Path',
    x: 0,
    y: 0,
    width: 100,
    height: 0,
    vectorNetwork: {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    }
  })
  return { frame: frame.id, path: path.id }
}

/** Continues the path from its end, in page coordinates, as resuming from an endpoint does. */
function resume(id: string) {
  const node = getNodeOrThrow(editor.graph, id)
  editor.state.penState = {
    vertices: [
      { x: 200, y: 100 },
      { x: 300, y: 100 }
    ],
    segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
    dragTangent: null,
    oppositeDragTangent: null,
    closingToFirst: false,
    pendingClose: false,
    resumingNodeId: id,
    resumedFills: [...node.fills],
    resumedStrokes: [...node.strokes]
  }
}

describe('continuing a pen path', () => {
  test('grows the same layer, where it is, and one undo puts its path back', () => {
    const { frame, path } = setup()
    resume(path)
    editor.penAddVertex(300, 150)
    editor.penCommit(false)

    expect(getNodeOrThrow(editor.graph, frame).childIds).toEqual([path])
    const grown = getNodeOrThrow(editor.graph, path)
    expect(grown.name).toBe('Path')
    expect(grown.vectorNetwork?.segments).toHaveLength(2)
    expect({ x: grown.x, y: grown.y, width: grown.width, height: grown.height }).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 50
    })
    expect([...editor.state.selectedIds]).toEqual([path])

    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, path).vectorNetwork?.segments).toHaveLength(1)
    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, path).vectorNetwork?.segments).toHaveLength(2)
  })

  test('committing without a new point leaves the layer and the undo history alone', () => {
    const { path } = setup()
    const before = getNodeOrThrow(editor.graph, path).vectorNetwork
    resume(path)
    editor.penCommit(false)
    expect(getNodeOrThrow(editor.graph, path).vectorNetwork).toBe(before)
    expect(editor.undo.canUndo).toBe(false)
  })

  test('makes a new layer when the one it came from is gone', () => {
    const { frame, path } = setup()
    resume(path)
    editor.graph.deleteNode(path)
    editor.penAddVertex(300, 150)
    editor.penCommit(false)
    expect(getNodeOrThrow(editor.graph, frame).childIds).toEqual([])
    const [created] = editor.state.selectedIds
    expect(getNodeOrThrow(editor.graph, created).vectorNetwork?.segments).toHaveLength(2)
  })
})
