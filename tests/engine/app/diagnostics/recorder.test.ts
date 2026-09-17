import { beforeEach, describe, expect, test } from 'bun:test'

import { diagnostics, recordChatCompleted } from '@/app/diagnostics'
import { recordModelStepCompleted, recordToolCompleted } from '@/app/diagnostics/events/ai'
import { useDiagnosticsSettings } from '@/app/diagnostics/settings'

describe('diagnostics recorder', () => {
  beforeEach(async () => {
    await diagnostics.clear()
  })

  test('records structured events and exports them', async () => {
    recordChatCompleted({ finishReason: 'stop' })

    const events = await diagnostics.list()
    expect(events).toHaveLength(1)
    expect(events[0]?.name).toBe('chat.completed')
    expect(await diagnostics.export()).toContain('chat.completed')
  })

  test('exports correlated AI metadata without transcript or tool payloads', async () => {
    const context = { sessionId: 'conversation-one', runId: 'request-one' }
    const tool = {
      tool: 'create_node',
      durationMs: 5,
      mutates: true,
      failed: false,
      input: 'private tool input',
      output: 'private tool output'
    }
    recordToolCompleted(tool, context)
    recordModelStepCompleted(
      {
        provider: 'openrouter',
        model: 'test',
        inputTokens: 10,
        outputTokens: 2,
        cacheReadTokens: null,
        cacheWriteTokens: null
      },
      context
    )
    recordChatCompleted({ finishReason: 'stop' }, context)
    const events = await diagnostics.list()
    expect(events).toHaveLength(3)
    for (const event of events) {
      expect(event.sessionId).toBe(context.sessionId)
      expect(event.runId).toBe(context.runId)
    }
    const output = await diagnostics.export()
    expect(output).toContain('"cacheReadTokens": null')
    expect(output).not.toContain('private tool')
    expect(output).not.toContain('messages')
  })

  test('disabling diagnostics also disables tool telemetry', async () => {
    const { diagnosticsEnabled } = useDiagnosticsSettings()
    const previous = diagnosticsEnabled.value
    try {
      diagnosticsEnabled.value = false
      recordToolCompleted(
        { tool: 'create_node', durationMs: 5, mutates: true, failed: false },
        { sessionId: 'disabled', runId: 'disabled-run' }
      )
      expect(await diagnostics.list()).toEqual([])
    } finally {
      diagnosticsEnabled.value = previous
    }
  })

  test('clears recorded events', async () => {
    recordChatCompleted({ finishReason: 'stop' })
    await diagnostics.clear()
    expect(await diagnostics.list()).toHaveLength(0)
  })
})
