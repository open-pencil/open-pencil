import { describe, expect, test } from 'bun:test'

import { diagnostics, recordChatCompleted } from '@/app/diagnostics'

describe('diagnostic subscriptions', () => {
  test('notifies on record and clear, then unsubscribes', async () => {
    await diagnostics.clear()
    let calls = 0
    const unsubscribe = diagnostics.subscribe(() => {
      calls++
    })

    recordChatCompleted({ finishReason: 'stop' })
    await diagnostics.clear()
    expect(calls).toBe(2)

    unsubscribe()
    recordChatCompleted({ finishReason: 'stop' })
    expect(calls).toBe(2)
    await diagnostics.clear()
  })
})
