import { beforeEach, describe, expect, test } from 'bun:test'

import { diagnostics, recordChatCompleted } from '@/app/diagnostics'
import { isDiagnosticsEnabled } from '@/app/diagnostics/settings'

void isDiagnosticsEnabled

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

  test('clears recorded events', async () => {
    recordChatCompleted({ finishReason: 'stop' })
    await diagnostics.clear()
    expect(await diagnostics.list()).toHaveLength(0)
  })
})
