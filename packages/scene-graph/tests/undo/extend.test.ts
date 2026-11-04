import { expect, test } from 'bun:test'

import { UndoManager } from '@open-pencil/scene-graph/undo'

test('a change a step caused joins it, so undo and redo apply them together', () => {
  const undo = new UndoManager()
  const log: string[] = []
  const step = { label: 'Move', forward: () => log.push('move'), inverse: () => log.push('unmove') }
  undo.push(step)
  const joined = undo.extendLastStep({
    label: 'Carry',
    forward: () => log.push('carry'),
    inverse: () => log.push('uncarry')
  })
  expect(joined).toBe(true)
  undo.undo()
  undo.redo()
  expect(log).toEqual(['uncarry', 'unmove', 'move', 'carry'])
  // The step is still the one its caller recorded.
  expect(undo.stateOf(step)).toBe('applied')
})

test('there is nothing to join before the first step', () => {
  const undo = new UndoManager()
  const noop = () => undefined
  expect(undo.extendLastStep({ label: 'Carry', forward: noop, inverse: noop })).toBe(false)
})

test('undo and redo say they are replaying while a step runs', () => {
  const undo = new UndoManager()
  const seen: boolean[] = []
  undo.push({
    label: 'Edit',
    forward: () => seen.push(undo.isReplaying),
    inverse: () => seen.push(undo.isReplaying)
  })
  expect(undo.isReplaying).toBe(false)
  undo.undo()
  undo.redo()
  expect(seen).toEqual([true, true])
  expect(undo.isReplaying).toBe(false)
})
