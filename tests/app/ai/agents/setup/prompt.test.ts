import { describe, expect, test } from 'bun:test'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import { agentCommandNames } from '@/app/ai/agents/setup/discovery'
import { codingAgentSetupPrompt } from '@/app/ai/agents/setup/prompt'

import { expectDefined } from '#tests/helpers/assert'

describe('coding agent setup prompt', () => {
  test('names every executable an agent can start as', () => {
    for (const id of ['cursor', 'claude-code'] as const) {
      const agent = expectDefined(
        ACP_AGENTS.find((candidate) => candidate.id === id),
        id
      )
      const prompt = codingAgentSetupPrompt(agent.id)
      for (const name of agentCommandNames(agent)) {
        expect(prompt).toContain(`\`${name}\``)
        expect(prompt).toContain(`which ${name}`)
      }
    }
  })

  test('tells a Cursor install to sign in with whichever command it has', () => {
    const agent = expectDefined(
      ACP_AGENTS.find((candidate) => candidate.id === 'cursor'),
      'Cursor'
    )
    const prompt = codingAgentSetupPrompt(agent.id)
    for (const name of agentCommandNames(agent)) {
      expect(prompt).toContain(`\`${name} login\``)
    }
  })
})
