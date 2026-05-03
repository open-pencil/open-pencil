import { describe, test, expect } from 'bun:test'

import { createUndoManager, undoEntry } from '../helpers/undo'

describe('UndoManager', () => {
  test('initial state', () => {
    const undo = createUndoManager()
    expect(undo.canUndo).toBe(false)
    expect(undo.canRedo).toBe(false)
    expect(undo.undoLabel).toBeNull()
    expect(undo.redoLabel).toBeNull()
  })

  test('apply executes forward and enables undo', () => {
    const undo = createUndoManager()
    let value = 0
    undo.apply(
      undoEntry(
        'increment',
        () => {
          value = 1
        },
        () => {
          value = 0
        }
      )
    )
    expect(value).toBe(1)
    expect(undo.canUndo).toBe(true)
    expect(undo.undoLabel).toBe('increment')
  })

  test('push does not execute forward', () => {
    const undo = createUndoManager()
    let value = 0
    undo.push(
      undoEntry(
        'set',
        () => {
          value = 1
        },
        () => {
          value = 0
        }
      )
    )
    expect(value).toBe(0)
    expect(undo.canUndo).toBe(true)
  })

  test('undo calls inverse and returns label', () => {
    const undo = createUndoManager()
    let value = 0
    undo.apply(
      undoEntry(
        'set',
        () => {
          value = 1
        },
        () => {
          value = 0
        }
      )
    )
    const label = undo.undo()
    expect(label).toBe('set')
    expect(value).toBe(0)
    expect(undo.canUndo).toBe(false)
    expect(undo.canRedo).toBe(true)
  })

  test('redo calls forward and returns label', () => {
    const undo = createUndoManager()
    let value = 0
    undo.apply(
      undoEntry(
        'set',
        () => {
          value = 1
        },
        () => {
          value = 0
        }
      )
    )
    undo.undo()
    const label = undo.redo()
    expect(label).toBe('set')
    expect(value).toBe(1)
    expect(undo.canRedo).toBe(false)
  })

  test('new action clears redo stack', () => {
    const undo = createUndoManager()
    undo.apply(undoEntry('a'))
    undo.undo()
    expect(undo.canRedo).toBe(true)
    undo.apply(undoEntry('b'))
    expect(undo.canRedo).toBe(false)
  })

  test('undo on empty returns null', () => {
    const undo = createUndoManager()
    expect(undo.undo()).toBeNull()
  })

  test('redo on empty returns null', () => {
    const undo = createUndoManager()
    expect(undo.redo()).toBeNull()
  })

  test('clear empties both stacks', () => {
    const undo = createUndoManager()
    undo.apply(undoEntry('a'))
    undo.undo()
    undo.clear()
    expect(undo.canUndo).toBe(false)
    expect(undo.canRedo).toBe(false)
  })

  test('history limit drops oldest entries', () => {
    const undo = createUndoManager({ limit: 2 })
    let val = 0
    undo.apply(
      undoEntry(
        'to1',
        () => {
          val = 1
        },
        () => {
          val = 0
        }
      )
    )
    undo.apply(
      undoEntry(
        'to2',
        () => {
          val = 2
        },
        () => {
          val = 1
        }
      )
    )
    undo.apply(
      undoEntry(
        'to3',
        () => {
          val = 3
        },
        () => {
          val = 2
        }
      )
    )

    expect(undo.undoLabel).toBe('to3')
    undo.undo()
    undo.undo()
    expect(val).toBe(1)
    expect(undo.undo()).toBeNull()
  })

  test('batch combines into single entry', () => {
    const undo = createUndoManager()
    const log: number[] = []
    undo.beginBatch('batch')
    undo.apply(
      undoEntry(
        'a',
        () => log.push(1),
        () => log.push(-1)
      )
    )
    undo.apply(
      undoEntry(
        'b',
        () => log.push(2),
        () => log.push(-2)
      )
    )
    undo.commitBatch()
    expect(log).toEqual([1, 2])
    expect(undo.undoLabel).toBe('batch')

    undo.undo()
    expect(log).toEqual([1, 2, -2, -1])
  })

  test('runBatch commits on success', () => {
    const undo = createUndoManager()
    const log: number[] = []

    undo.runBatch('batch', () => {
      undo.apply(
        undoEntry(
          'a',
          () => log.push(1),
          () => log.push(-1)
        )
      )
      undo.apply(
        undoEntry(
          'b',
          () => log.push(2),
          () => log.push(-2)
        )
      )
    })

    expect(log).toEqual([1, 2])
    expect(undo.undoLabel).toBe('batch')
    undo.undo()
    expect(log).toEqual([1, 2, -2, -1])
  })

  test('runBatch rolls back on throw', () => {
    const undo = createUndoManager()
    const log: number[] = []

    expect(() =>
      undo.runBatch('batch', () => {
        undo.apply(
          undoEntry(
            'a',
            () => log.push(1),
            () => log.push(-1)
          )
        )
        throw new Error('boom')
      })
    ).toThrow('boom')

    expect(log).toEqual([1, -1])
    expect(undo.canUndo).toBe(false)
  })

  test('nested batches commit as a single outer entry', () => {
    const undo = createUndoManager()
    const log: number[] = []

    undo.runBatch('outer', () => {
      undo.apply(
        undoEntry(
          'a',
          () => log.push(1),
          () => log.push(-1)
        )
      )
      undo.runBatch('inner', () => {
        undo.apply(
          undoEntry(
            'b',
            () => log.push(2),
            () => log.push(-2)
          )
        )
      })
    })

    expect(undo.undoLabel).toBe('outer')
    undo.undo()
    expect(log).toEqual([1, 2, -2, -1])
  })

  test('empty batch commits nothing', () => {
    const undo = createUndoManager()
    undo.beginBatch('empty')
    undo.commitBatch()
    expect(undo.canUndo).toBe(false)
  })

  test('multiple undo/redo', () => {
    const undo = createUndoManager()
    let val = 0
    undo.apply(
      undoEntry(
        'to1',
        () => {
          val = 1
        },
        () => {
          val = 0
        }
      )
    )
    undo.apply(
      undoEntry(
        'to2',
        () => {
          val = 2
        },
        () => {
          val = 1
        }
      )
    )
    undo.apply(
      undoEntry(
        'to3',
        () => {
          val = 3
        },
        () => {
          val = 2
        }
      )
    )

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
