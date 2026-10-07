import { describe, expect, test } from 'bun:test'

import { parsePiSettings } from '@/app/ai/harness/pi-settings'

describe('parsePiSettings', () => {
  test('reads the default model', () => {
    expect(
      parsePiSettings(
        JSON.stringify({ defaultProvider: 'openai-codex', defaultModel: 'openai-codex/gpt-5.6' })
      )
    ).toBe('openai-codex/gpt-5.6')
  })

  test('ignores missing, empty, or malformed settings', () => {
    expect(parsePiSettings('{}')).toBeNull()
    expect(parsePiSettings(JSON.stringify({ defaultModel: '  ' }))).toBeNull()
    expect(parsePiSettings(JSON.stringify({ defaultModel: 42 }))).toBeNull()
    expect(parsePiSettings('not json')).toBeNull()
  })
})
