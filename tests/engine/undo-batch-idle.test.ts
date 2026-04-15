import { describe, test, expect } from 'bun:test'

import { UndoManager } from '@open-pencil/core'

describe('UndoManager idle-timer batching', () => {
  function noop() {}
  function entry(label: string, forward = noop, inverse = noop) {
    return { label, forward, inverse }
  }

  test('rapid pushes inside a batch produce a single undo entry', () => {
    const undo = new UndoManager()
    let value = 0

    undo.beginBatch('drag color')
    for (let i = 1; i <= 10; i++) {
      const prev = value
      const next = i
      undo.push({ label: `step ${i}`, forward: () => { value = next }, inverse: () => { value = prev } })
      value = next
    }
    undo.commitBatch()

    expect(value).toBe(10)
    expect(undo.undoLabel).toBe('drag color')

    undo.undo()
    expect(value).toBe(0)
    expect(undo.canUndo).toBe(false)
  })

  test('changing batch key flushes the previous batch', () => {
    const undo = new UndoManager()
    let a = 0
    let b = 0

    undo.beginBatch('batch A')
    undo.push(entry('a1', () => { a = 1 }, () => { a = 0 }))
    a = 1
    undo.push(entry('a2', () => { a = 2 }, () => { a = 1 }))
    a = 2
    undo.commitBatch()

    undo.beginBatch('batch B')
    undo.push(entry('b1', () => { b = 10 }, () => { b = 0 }))
    b = 10
    undo.commitBatch()

    expect(undo.undoLabel).toBe('batch B')
    undo.undo()
    expect(b).toBe(0)

    expect(undo.undoLabel).toBe('batch A')
    undo.undo()
    expect(a).toBe(0)
  })

  test('discrete action between batches is separate undo entry', () => {
    const undo = new UndoManager()
    let v = 0

    undo.beginBatch('drag')
    undo.push(entry('d1', () => { v = 1 }, () => { v = 0 }))
    v = 1
    undo.push(entry('d2', () => { v = 2 }, () => { v = 1 }))
    v = 2
    undo.commitBatch()

    undo.push(entry('add fill', () => { v = 100 }, () => { v = 2 }))
    v = 100

    undo.undo()
    expect(v).toBe(2)

    undo.undo()
    expect(v).toBe(0)
  })

  test('batch redo replays all steps in order', () => {
    const undo = new UndoManager()
    const log: number[] = []

    undo.beginBatch('batch')
    undo.apply(entry('s1', () => log.push(1), () => log.pop()))
    undo.apply(entry('s2', () => log.push(2), () => log.pop()))
    undo.apply(entry('s3', () => log.push(3), () => log.pop()))
    undo.commitBatch()

    expect(log).toEqual([1, 2, 3])

    undo.undo()
    expect(log).toEqual([])

    undo.redo()
    expect(log).toEqual([1, 2, 3])
  })

  test('commitBatch with no entries is a no-op', () => {
    const undo = new UndoManager()
    undo.push(entry('existing', noop, noop))

    undo.beginBatch('empty')
    undo.commitBatch()

    expect(undo.undoLabel).toBe('existing')
  })
})
