import { expect, test } from 'bun:test'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import { expectDefined } from '@open-pencil/test-support/assert'

import { agentModelName, rememberAgentOffer } from '@/app/ai/agents/acp/offers'

const grok = expectDefined(
  ACP_AGENTS.find((agent) => agent.id === 'grok-build'),
  'Grok Build agent'
)

test('a model is named as the agent names it once its offer is known, and by nothing before', async () => {
  expect(agentModelName(grok, 'fast')).toBeNull()
  await rememberAgentOffer(grok, {
    imageInput: true,
    models: [{ id: 'fast', name: 'Grok Fast 4.7' }]
  })
  expect(agentModelName(grok, 'fast')).toBe('Grok Fast 4.7')
  expect(agentModelName(grok, 'not-listed')).toBeNull()
})
