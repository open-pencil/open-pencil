import { describe, test, expect } from 'bun:test'

import { SceneGraph, UndoManager } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'

// ---------------------------------------------------------------------------
// SceneGraph + UndoManager — integration (updateNodeWithUndo pattern)
// ---------------------------------------------------------------------------

describe('SceneGraph + UndoManager — updateNode undo integration', () => {
  function makeSetup() {
    const graph = new SceneGraph()
    const undo = new UndoManager()
    const pageId = graph.getPages()[0].id

    function updateWithUndo(
      id: string,
      changes: Partial<Parameters<SceneGraph['updateNode']>[1]>,
      label: string
    ) {
      const node = getNodeOrThrow(graph, id)
      const previous = Object.fromEntries(
        (Object.keys(changes) as string[]).map((k) => [k, (node as Record<string, unknown>)[k]])
      )
      graph.updateNode(id, changes)
      undo.push({
        label,
        forward: () => graph.updateNode(id, changes),
        inverse: () => graph.updateNode(id, previous as Parameters<SceneGraph['updateNode']>[1])
      })
    }

    return { graph, undo, pageId, updateWithUndo }
  }

  test('update then undo restores previous value', () => {
    const { graph, undo, pageId, updateWithUndo } = makeSetup()
    const id = graph.createNode('RECTANGLE', pageId, { x: 0, y: 0, width: 100, height: 100 }).id

    updateWithUndo(id, { x: 200 }, 'move')
    expect(getNodeOrThrow(graph, id).x).toBe(200)

    undo.undo()
    expect(getNodeOrThrow(graph, id).x).toBe(0)
  })

  test('update → undo → redo restores updated value', () => {
    const { graph, undo, pageId, updateWithUndo } = makeSetup()
    const id = graph.createNode('RECTANGLE', pageId, { x: 0, y: 0, width: 100, height: 100 }).id

    updateWithUndo(id, { width: 250 }, 'resize')
    undo.undo()
    expect(getNodeOrThrow(graph, id).width).toBe(100)
    undo.redo()
    expect(getNodeOrThrow(graph, id).width).toBe(250)
  })

  test('multiple updates undo in LIFO order', () => {
    const { graph, undo, pageId, updateWithUndo } = makeSetup()
    const id = graph.createNode('RECTANGLE', pageId, { x: 0, y: 0, width: 100, height: 100 }).id

    updateWithUndo(id, { x: 10 }, 'step1')
    updateWithUndo(id, { x: 20 }, 'step2')
    updateWithUndo(id, { x: 30 }, 'step3')

    undo.undo()
    expect(getNodeOrThrow(graph, id).x).toBe(20)
    undo.undo()
    expect(getNodeOrThrow(graph, id).x).toBe(10)
    undo.undo()
    expect(getNodeOrThrow(graph, id).x).toBe(0)
  })

  test('new action after undo clears redo stack', () => {
    const { graph, undo, pageId, updateWithUndo } = makeSetup()
    const id = graph.createNode('RECTANGLE', pageId, { x: 0, y: 0, width: 100, height: 100 }).id

    updateWithUndo(id, { x: 100 }, 'a')
    updateWithUndo(id, { x: 200 }, 'b')
    undo.undo()
    expect(undo.canRedo).toBe(true)

    // new action should kill redo
    updateWithUndo(id, { x: 300 }, 'c')
    expect(undo.canRedo).toBe(false)
    expect(getNodeOrThrow(graph, id).x).toBe(300)
  })

  test('undo does not affect other nodes', () => {
    const { graph, undo, pageId, updateWithUndo } = makeSetup()
    const a = graph.createNode('RECTANGLE', pageId, { x: 0, y: 0, width: 50, height: 50 }).id
    const b = graph.createNode('RECTANGLE', pageId, { x: 0, y: 0, width: 50, height: 50 }).id

    updateWithUndo(a, { x: 100 }, 'move a')
    updateWithUndo(b, { x: 200 }, 'move b')

    undo.undo() // undoes move b
    expect(getNodeOrThrow(graph, b).x).toBe(0)
    expect(getNodeOrThrow(graph, a).x).toBe(100) // a unaffected

    undo.undo() // undoes move a
    expect(getNodeOrThrow(graph, a).x).toBe(0)
  })

  test('multi-field update: all fields restored on undo', () => {
    const { graph, undo, pageId, updateWithUndo } = makeSetup()
    const id = graph.createNode('RECTANGLE', pageId, { x: 0, y: 0, width: 100, height: 100 }).id

    updateWithUndo(id, { x: 50, y: 75, width: 200, height: 300 }, 'big move')
    const after = getNodeOrThrow(graph, id)
    expect(after.x).toBe(50)
    expect(after.y).toBe(75)
    expect(after.width).toBe(200)
    expect(after.height).toBe(300)

    undo.undo()
    const restored = getNodeOrThrow(graph, id)
    expect(restored.x).toBe(0)
    expect(restored.y).toBe(0)
    expect(restored.width).toBe(100)
    expect(restored.height).toBe(100)
  })

  test('batch: multiple updates undo as one', () => {
    const { graph, undo, pageId } = makeSetup()
    const id = graph.createNode('RECTANGLE', pageId, { x: 0, y: 0, width: 100, height: 100 }).id

    undo.beginBatch('batch move')
    undo.apply({
      label: 'x',
      forward: () => graph.updateNode(id, { x: 10 }),
      inverse: () => graph.updateNode(id, { x: 0 })
    })
    undo.apply({
      label: 'y',
      forward: () => graph.updateNode(id, { y: 20 }),
      inverse: () => graph.updateNode(id, { y: 0 })
    })
    undo.commitBatch()

    expect(getNodeOrThrow(graph, id).x).toBe(10)
    expect(getNodeOrThrow(graph, id).y).toBe(20)
    expect(undo.undoLabel).toBe('batch move')

    undo.undo()
    expect(getNodeOrThrow(graph, id).x).toBe(0)
    expect(getNodeOrThrow(graph, id).y).toBe(0)
  })
})
