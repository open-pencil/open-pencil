import { describe, test, expect } from 'bun:test'

import { UndoManager } from '@open-pencil/core'

describe('UndoManager', () => {
  test('initial state', () => {
    const undo = new UndoManager()
    expect(undo.canUndo).toBe(false)
    expect(undo.canRedo).toBe(false)
    expect(undo.undoLabel).toBeNull()
    expect(undo.redoLabel).toBeNull()
  })

  test('apply executes forward and enables undo', () => {
    const undo = new UndoManager()
    let value = 0
    undo.apply({
      label: 'increment',
      forward: () => { value = 1 },
      inverse: () => { value = 0 }
    })
    expect(value).toBe(1)
    expect(undo.canUndo).toBe(true)
    expect(undo.undoLabel).toBe('increment')
  })

  test('push does not execute forward', () => {
    const undo = new UndoManager()
    let value = 0
    undo.push({
      label: 'set',
      forward: () => { value = 1 },
      inverse: () => { value = 0 }
    })
    expect(value).toBe(0)
    expect(undo.canUndo).toBe(true)
  })

  test('undo calls inverse and returns label', () => {
    const undo = new UndoManager()
    let value = 0
    undo.apply({
      label: 'set',
      forward: () => { value = 1 },
      inverse: () => { value = 0 }
    })
    const label = undo.undo()
    expect(label).toBe('set')
    expect(value).toBe(0)
    expect(undo.canUndo).toBe(false)
    expect(undo.canRedo).toBe(true)
  })

  test('redo calls forward and returns label', () => {
    const undo = new UndoManager()
    let value = 0
    undo.apply({
      label: 'set',
      forward: () => { value = 1 },
      inverse: () => { value = 0 }
    })
    undo.undo()
    const label = undo.redo()
    expect(label).toBe('set')
    expect(value).toBe(1)
    expect(undo.canRedo).toBe(false)
  })

  test('new action clears redo stack', () => {
    const undo = new UndoManager()
    undo.apply({ label: 'a', forward: () => {}, inverse: () => {} })
    undo.undo()
    expect(undo.canRedo).toBe(true)
    undo.apply({ label: 'b', forward: () => {}, inverse: () => {} })
    expect(undo.canRedo).toBe(false)
  })

  test('undo on empty returns null', () => {
    const undo = new UndoManager()
    expect(undo.undo()).toBeNull()
  })

  test('redo on empty returns null', () => {
    const undo = new UndoManager()
    expect(undo.redo()).toBeNull()
  })

  test('clear empties both stacks', () => {
    const undo = new UndoManager()
    undo.apply({ label: 'a', forward: () => {}, inverse: () => {} })
    undo.undo()
    undo.clear()
    expect(undo.canUndo).toBe(false)
    expect(undo.canRedo).toBe(false)
  })

  test('batch combines into single entry', () => {
    const undo = new UndoManager()
    const log: number[] = []
    undo.beginBatch('batch')
    undo.apply({ label: 'a', forward: () => log.push(1), inverse: () => log.push(-1) })
    undo.apply({ label: 'b', forward: () => log.push(2), inverse: () => log.push(-2) })
    undo.commitBatch()
    expect(log).toEqual([1, 2])
    expect(undo.undoLabel).toBe('batch')

    undo.undo()
    expect(log).toEqual([1, 2, -2, -1])
  })

  test('empty batch commits nothing', () => {
    const undo = new UndoManager()
    undo.beginBatch('empty')
    undo.commitBatch()
    expect(undo.canUndo).toBe(false)
  })

  test('multiple undo/redo', () => {
    const undo = new UndoManager()
    let val = 0
    undo.apply({ label: 'to1', forward: () => { val = 1 }, inverse: () => { val = 0 } })
    undo.apply({ label: 'to2', forward: () => { val = 2 }, inverse: () => { val = 1 } })
    undo.apply({ label: 'to3', forward: () => { val = 3 }, inverse: () => { val = 2 } })

    undo.undo()
    expect(val).toBe(2)
    undo.undo()
    expect(val).toBe(1)
    undo.redo()
    expect(val).toBe(2)
    undo.redo()
    expect(val).toBe(3)
  })
})
