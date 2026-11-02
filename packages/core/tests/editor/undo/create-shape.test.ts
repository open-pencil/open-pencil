import { describe, test, expect } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import { createEditor } from '@open-pencil/core'

describe('create shape undo/redo', () => {
  test('batched create+resize undoes in one step', () => {
    const editor = createEditor()

    // Simulate draw tool: batch(create + resize)
    editor.undo.beginBatch('Create shape')
    const id = editor.createShape('RECTANGLE', 100, 100, 0, 0)
    editor.graph.updateNode(id, { x: 100, y: 100, width: 200, height: 150 })
    editor.commitResize(id, { x: 100, y: 100, width: 0, height: 0 })
    editor.undo.commitBatch()

    expect(getNodeOrThrow(editor.graph, id).width).toBe(200)
    expect(getNodeOrThrow(editor.graph, id).height).toBe(150)

    // Single undo removes the shape entirely
    editor.undo.undo()
    expect(editor.graph.getNode(id)).toBeUndefined()

    // Single redo restores with full dimensions
    editor.undo.redo()
    const restored = getNodeOrThrow(editor.graph, id)
    expect(restored.width).toBe(200)
    expect(restored.height).toBe(150)
    expect(restored.x).toBe(100)
    expect(restored.y).toBe(100)
  })

  test('redo after create+move+duplicate restores correct state', () => {
    const editor = createEditor()

    // Create shape via draw tool (batched)
    editor.undo.beginBatch('Create shape')
    const id = editor.createShape('RECTANGLE', 50, 50, 0, 0)
    editor.graph.updateNode(id, { x: 50, y: 50, width: 120, height: 80 })
    editor.commitResize(id, { x: 50, y: 50, width: 0, height: 0 })
    editor.undo.commitBatch()

    // Move it
    editor.select([id])
    editor.graph.updateNode(id, { x: 200, y: 200 })
    editor.commitMove(new Map([[id, { x: 50, y: 50 }]]))

    // Undo move
    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, id).x).toBe(50)

    // Undo create (single step)
    editor.undo.undo()
    expect(editor.graph.getNode(id)).toBeUndefined()

    // Redo create (single step, full dimensions)
    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, id).width).toBe(120)

    // Redo move
    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, id).x).toBe(200)
  })
})

describe('pen path undo/redo', () => {
  test('redo brings back the path, fills and strokes, not an empty vector', () => {
    const editor = createEditor()
    editor.setTool('PEN')
    editor.penAddVertex(0, 0)
    editor.penAddVertex(100, 0)
    editor.penAddVertex(100, 50)
    editor.penCommit(false)
    const id = [...editor.state.selectedIds][0]
    const drawn = getNodeOrThrow(editor.graph, id)
    expect(drawn.vectorNetwork?.segments).toHaveLength(2)

    editor.undo.undo()
    expect(editor.graph.getNode(id)).toBeUndefined()

    editor.undo.redo()
    const restored = getNodeOrThrow(editor.graph, id)
    expect(restored.vectorNetwork).toEqual(drawn.vectorNetwork)
    expect(restored.strokes).toEqual(drawn.strokes)
    expect(restored.fills).toEqual(drawn.fills)
  })
})
