import { expect, test } from 'bun:test'

import { UndoManager, type HistoryChange } from '@open-pencil/scene-graph/undo'

test('history says why it changed, and nothing when a step only joins another', () => {
  const changes: HistoryChange[] = []
  const undo = new UndoManager({ onChange: (change) => changes.push(change) })
  const noop = () => undefined
  undo.push({ label: 'Move', forward: noop, inverse: noop })
  undo.extendLastStep({ label: 'Snap', forward: noop, inverse: noop })
  undo.runBatch('Nudge', () => undo.push({ label: 'Nudge', forward: noop, inverse: noop }))
  undo.undo()
  undo.redo()
  undo.clear()
  expect(changes).toEqual(['record', 'record', 'undo', 'redo', 'clear'])
})
