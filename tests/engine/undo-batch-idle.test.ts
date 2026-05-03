import { describe, test, expect } from 'bun:test'

import { createUndoManager, noop, undoEntry } from '../helpers/undo'

describe('UndoManager idle-timer batching', () => {
  test('rapid pushes inside a batch produce a single undo entry', () => {
    const undo = createUndoManager()
    let value = 0

    undo.beginBatch('drag color')
    for (let i = 1; i <= 10; i++) {
      const prev = value
      const next = i
      undo.push(
        undoEntry(
          `step ${i}`,
          () => {
            value = next
          },
          () => {
            value = prev
          }
        )
      )
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
    const undo = createUndoManager()
    let a = 0
    let b = 0

    undo.beginBatch('batch A')
    undo.push(
      undoEntry(
        'a1',
        () => {
          a = 1
        },
        () => {
          a = 0
        }
      )
    )
    a = 1
    undo.push(
      undoEntry(
        'a2',
        () => {
          a = 2
        },
        () => {
          a = 1
        }
      )
    )
    a = 2
    undo.commitBatch()

    undo.beginBatch('batch B')
    undo.push(
      undoEntry(
        'b1',
        () => {
          b = 10
        },
        () => {
          b = 0
        }
      )
    )
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
    const undo = createUndoManager()
    let v = 0

    undo.beginBatch('drag')
    undo.push(
      undoEntry(
        'd1',
        () => {
          v = 1
        },
        () => {
          v = 0
        }
      )
    )
    v = 1
    undo.push(
      undoEntry(
        'd2',
        () => {
          v = 2
        },
        () => {
          v = 1
        }
      )
    )
    v = 2
    undo.commitBatch()

    undo.push(
      undoEntry(
        'add fill',
        () => {
          v = 100
        },
        () => {
          v = 2
        }
      )
    )
    v = 100

    undo.undo()
    expect(v).toBe(2)

    undo.undo()
    expect(v).toBe(0)
  })

  test('batch redo replays all steps in order', () => {
    const undo = createUndoManager()
    const log: number[] = []

    undo.beginBatch('batch')
    undo.apply(
      undoEntry(
        's1',
        () => log.push(1),
        () => log.pop()
      )
    )
    undo.apply(
      undoEntry(
        's2',
        () => log.push(2),
        () => log.pop()
      )
    )
    undo.apply(
      undoEntry(
        's3',
        () => log.push(3),
        () => log.pop()
      )
    )
    undo.commitBatch()

    expect(log).toEqual([1, 2, 3])

    undo.undo()
    expect(log).toEqual([])

    undo.redo()
    expect(log).toEqual([1, 2, 3])
  })

  test('commitBatch with no entries is a no-op', () => {
    const undo = createUndoManager()
    undo.push(undoEntry('existing', noop, noop))

    undo.beginBatch('empty')
    undo.commitBatch()

    expect(undo.undoLabel).toBe('existing')
  })
})
