import { describe, expect, jest, test } from 'bun:test'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import { expectDefined } from '@open-pencil/test-support/assert'

import { boundAgentStart } from '@/app/ai/agents/acp/startup'

const agent = expectDefined(
  ACP_AGENTS.find((candidate) => candidate.id === 'claude-code'),
  'Claude agent'
)

describe('the deadline on a startup request', () => {
  test('leaves no timer running once the request is answered or failed', async () => {
    jest.useFakeTimers()
    try {
      const { bounded } = boundAgentStart(agent, { stopMessage: 'Stopped.' })
      expect(await bounded(Promise.resolve('answer'))).toBe('answer')
      await expect(bounded(Promise.reject(new Error('Refused.')))).rejects.toThrow()
      expect(jest.getTimerCount()).toBe(0)
    } finally {
      jest.useRealTimers()
    }
  })
})
