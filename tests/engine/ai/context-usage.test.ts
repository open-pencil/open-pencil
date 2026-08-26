import { describe, expect, test } from 'bun:test'

import { calculateContextUsage, formatTokenCount } from '@/app/ai/chat/context-usage'

describe('context usage', () => {
  test('uses the latest step as the current context', () => {
    const usage = calculateContextUsage(
      [
        {
          inputTokens: 10_000,
          outputTokens: 500,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          timestamp: 1
        },
        {
          inputTokens: 34_000,
          outputTokens: 1_000,
          cacheReadTokens: 30_000,
          cacheWriteTokens: 0,
          timestamp: 2
        }
      ],
      258_000
    )

    expect(usage).toEqual({
      usedTokens: 35_000,
      totalTokens: 258_000,
      percentUsed: 14,
      percentLeft: 86
    })
  })

  test('still reports usage when the context window is unknown', () => {
    expect(
      calculateContextUsage([
        {
          inputTokens: 900,
          outputTokens: 100,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          timestamp: 1
        }
      ])
    ).toEqual({ usedTokens: 1_000 })
  })

  test('formats compact token counts', () => {
    expect(formatTokenCount(999)).toBe('999')
    expect(formatTokenCount(35_000)).toBe('35k')
    expect(formatTokenCount(258_000)).toBe('258k')
    expect(formatTokenCount(1_500_000)).toBe('1.5M')
  })
})
