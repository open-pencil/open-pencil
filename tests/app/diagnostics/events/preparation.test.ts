import 'fake-indexeddb/auto'
import { beforeEach, expect, test } from 'bun:test'

import { diagnostics, recordPreparationOutcome } from '@/app/diagnostics'
import {
  EDITOR_PREPARATION_KINDS,
  type EditorPreparationKind
} from '@/app/editor/preparation/types'

beforeEach(async () => {
  await diagnostics.clear()
})

test.each<EditorPreparationKind>([...EDITOR_PREPARATION_KINDS])(
  'records a finished %s preparation',
  async (kind) => {
    recordPreparationOutcome({
      kind,
      outcome: 'completed',
      cancellationReason: null,
      failureCode: null,
      terminalPhase: 'preparing-render',
      durationMs: 250
    })

    const [event] = await diagnostics.list()
    expect(event).toMatchObject({
      name: 'editor.preparation.finished',
      attributes: { kind, outcome: 'completed', durationBucket: '100ms-1s' }
    })
  }
)
