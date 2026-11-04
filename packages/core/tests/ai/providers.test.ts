import { describe, expect, test } from 'bun:test'

import { acpAgentFor } from '#core/ai/providers'

describe('acpAgentFor', () => {
  test('finds the agent an acp: provider ID names', () => {
    expect(acpAgentFor('acp:codex')?.id).toBe('codex')
    expect(acpAgentFor('acp:claude-code')?.id).toBe('claude-code')
  })

  test('rejects anything but an exact acp: provider ID', () => {
    for (const providerID of ['codex', 'xacp:codex', 'acp:codex ', 'acp:', 'acp:unknown', 'openai'])
      expect(acpAgentFor(providerID)).toBeUndefined()
  })
})
