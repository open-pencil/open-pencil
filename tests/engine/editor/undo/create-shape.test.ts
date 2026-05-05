import { describe, test, expect } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

describe('create shape undo/redo', () => {
  test('batched create+resize undoes in one step', () => {
    const editor = createEditor()

    // Simulate draw tool: batch(create + resize)
    editor.undo.beginBatch('Create shape')
    const id = editor.createShape('RECTANGLE', 100, 100, 0, 0)
    editor.graph.updateNode(id, { x: 100, y: 100, width: 200, height: 150 })
    editor.commitResize(id, { x: 100, y: 100, width: 0, height: 0 })
    editor.undo.commitBatch()

    expect(editor.graph.getNode(id)!.width).toBe(200)
    expect(editor.graph.getNode(id)!.height).toBe(150)

    // Single undo removes the shape entirely
    editor.undo.undo()
    expect(editor.graph.getNode(id)).toBeUndefined()

    // Single redo restores with full dimensions
    editor.undo.redo()
    expect(editor.graph.getNode(id)).not.toBeUndefined()
    expect(editor.graph.getNode(id)!.width).toBe(200)
    expect(editor.graph.getNode(id)!.height).toBe(150)
    expect(editor.graph.getNode(id)!.x).toBe(100)
    expect(editor.graph.getNode(id)!.y).toBe(100)
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
    expect(editor.graph.getNode(id)!.x).toBe(50)

    // Undo create (single step)
    editor.undo.undo()
    expect(editor.graph.getNode(id)).toBeUndefined()

    // Redo create (single step, full dimensions)
    editor.undo.redo()
    expect(editor.graph.getNode(id)!.width).toBe(120)

    // Redo move
    editor.undo.redo()
    expect(editor.graph.getNode(id)!.x).toBe(200)
  })
})
