import { afterEach, describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createRunPreview } from '@/app/ai/preview/run'
import { runAgentId, runPageId, startRun } from '@/app/ai/tools/run'
import { createEditorStore } from '@/app/editor/session'
import { onAgentPreview, type AgentPreviewEvent } from '@/app/presence/preview-stream'

import { expectDefined } from '#tests/helpers/assert'

const stores: ReturnType<typeof createEditorStore>[] = []
afterEach(() => {
  for (const store of stores.splice(0)) store.preparationController.dispose()
})

function recordedRun() {
  const store = createEditorStore(new SceneGraph())
  stores.push(store)
  const events: AgentPreviewEvent[] = []
  onAgentPreview(store, (event) => events.push(event))
  return { store, events, preview: createRunPreview(store) }
}

describe("the chat run's preview", () => {
  test("publishes the run's streamed render input for the room", () => {
    const { store, events, preview } = recordedRun()
    startRun(store, 10)
    const agentId = expectDefined(runAgentId(store), 'run agent')

    preview.start('call-1')
    preview.delta('call-1', '{"jsx":"<Frame')
    preview.finish('call-1')
    preview.clear()

    expect(events).toEqual([
      { type: 'start', agentId, callId: 'call-1', pageId: runPageId(store) },
      { type: 'delta', agentId, callId: 'call-1', text: '{"jsx":"<Frame' },
      { type: 'finish', agentId, callId: 'call-1' },
      { type: 'clear', agentId }
    ])
  })

  test('ends a stopped call for the room too', () => {
    const { store, events, preview } = recordedRun()
    startRun(store, 10)
    const agentId = expectDefined(runAgentId(store), 'run agent')
    const stop = new AbortController()

    preview.start('call-1', stop.signal)
    stop.abort()

    expect(events.at(-1)).toEqual({ type: 'finish', agentId, callId: 'call-1' })
  })

  test('a call that finished publishes nothing more when its request stops later', () => {
    const { store, events, preview } = recordedRun()
    startRun(store, 10)
    const request = new AbortController()

    preview.start('call-1', request.signal)
    preview.finish('call-1')
    request.abort()

    expect(events.filter((event) => event.type === 'finish')).toHaveLength(1)
  })

  test('publishes nothing before a run has an agent', () => {
    const { events, preview } = recordedRun()
    preview.start('call-1')
    preview.delta('call-1', '<Frame')
    preview.clear()
    expect(events).toEqual([])
  })
})
