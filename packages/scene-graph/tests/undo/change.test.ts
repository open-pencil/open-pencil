import { expect, test } from 'bun:test'

import { UndoManager, type HistoryChange } from '@open-pencil/scene-graph/undo'

test('history says why it changed', () => {
  const changes: HistoryChange[] = []
  const recorded: (string | undefined)[] = []
  const undo = new UndoManager({
    onChange: (change, step) => {
      changes.push(change)
      if (change === 'record' || change === 'join') recorded.push(step?.label)
    }
  })
  const noop = () => undefined
  undo.push({ label: 'Move', forward: noop, inverse: noop })
  undo.extendLastStep({ label: 'Snap', forward: noop, inverse: noop })
  undo.runBatch('Nudge', () => undo.push({ label: 'Nudge', forward: noop, inverse: noop }))
  undo.undo()
  undo.redo()
  undo.clear()
  expect(changes).toEqual(['record', 'join', 'record', 'undo', 'redo', 'clear'])
  expect(recorded).toEqual(['Move', 'Move', 'Nudge'])
})
