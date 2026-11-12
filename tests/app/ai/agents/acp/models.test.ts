import { describe, expect, test } from 'bun:test'

import type { SessionConfigOption } from '@agentclientprotocol/sdk'

import { agentModels } from '@/app/ai/agents/acp/models'

function select(
  id: string,
  category: string | undefined,
  options: Extract<SessionConfigOption, { type: 'select' }>['options'],
  currentValue = 'a'
): SessionConfigOption {
  return { id, name: id, type: 'select', category, currentValue, options }
}

describe('the models an agent offers', () => {
  test('come from its model option, which a session sets by value', () => {
    const offered = {
      configOptions: [
        select('mode', 'mode', [{ value: 'plan', name: 'Plan' }], 'plan'),
        select('model', 'model', [
          { value: 'a', name: 'Alpha' },
          { value: 'b', name: 'Beta' }
        ])
      ]
    }
    expect(agentModels(offered)).toEqual({
      current: 'a',
      options: [
        { id: 'a', name: 'Alpha' },
        { id: 'b', name: 'Beta' }
      ]
    })
  })

  test('are listed across the groups an agent sorts them into', () => {
    const offered = {
      configOptions: [
        select('model', 'model', [
          { group: 'one', name: 'One', options: [{ value: 'a', name: 'Alpha' }] },
          { group: 'two', name: 'Two', options: [{ value: 'b', name: 'Beta' }] }
        ])
      ]
    }
    expect(agentModels(offered)?.options.map((option) => option.id)).toEqual(['a', 'b'])
  })

  test('are found by the option’s id when the agent names no category', () => {
    const offered = { configOptions: [select('model', undefined, [{ value: 'a', name: 'Alpha' }])] }
    expect(agentModels(offered)?.options.map((option) => option.id)).toEqual(['a'])
  })

  test('come from the session’s own list when it has no model option', () => {
    const offered = {
      configOptions: [select('mode', 'mode', [{ value: 'plan', name: 'Plan' }], 'plan')],
      models: {
        currentModelId: 'fast',
        availableModels: [
          { modelId: 'fast', name: 'Fast' },
          { modelId: 'deep', name: 'Deep' }
        ]
      }
    }
    expect(agentModels(offered)).toEqual({
      current: 'fast',
      options: [
        { id: 'fast', name: 'Fast' },
        { id: 'deep', name: 'Deep' }
      ]
    })
  })

  test('are none when the agent offers no choice', () => {
    expect(agentModels({})).toBeNull()
    expect(agentModels({ configOptions: [], models: null })).toBeNull()
    expect(agentModels({ configOptions: [select('mode', 'mode', [])] })).toBeNull()
  })
})
