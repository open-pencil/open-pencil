import { expect, test } from 'bun:test'

import type {
  SessionConfigOption,
  SetSessionConfigOptionRequest
} from '@agentclientprotocol/sdk/unstable'

import { chooseSessionOption, sessionChoice } from '@/app/ai/agents/acp/options'

import { MODEL_OPTIONS } from '#tests/helpers/ai/fake-acp-agent'

/** Codex's shape: an effort option it names itself, and models listed in groups. */
const GROUPED: SessionConfigOption[] = [
  {
    id: 'reasoning_effort',
    name: 'Effort',
    type: 'select',
    category: 'thought_level',
    currentValue: 'medium',
    options: [
      { value: 'low', name: 'Low' },
      { value: 'medium', name: 'Medium' }
    ]
  },
  {
    id: 'model',
    name: 'Model',
    type: 'select',
    category: 'model',
    currentValue: 'fast',
    options: [
      { group: 'quick', name: 'Quick', options: [{ value: 'fast', name: 'Fast' }] },
      { group: 'thorough', name: 'Thorough', options: [{ value: 'deep', name: 'Deep' }] }
    ]
  }
]

function requests() {
  const configured: SetSessionConfigOptionRequest[] = []
  return {
    configured,
    async setConfigOption(params: SetSessionConfigOptionRequest) {
      configured.push(params)
      return { configOptions: [] }
    }
  }
}

test('an option is found by its category, whatever the agent names it', () => {
  expect(sessionChoice({ configOptions: GROUPED }, 'thought_level')).toEqual({
    configId: 'reasoning_effort',
    current: 'medium',
    values: [
      { id: 'low', name: 'Low' },
      { id: 'medium', name: 'Medium' }
    ]
  })
})

test('grouped values are listed together', () => {
  expect(sessionChoice({ configOptions: GROUPED }, 'model')?.values).toEqual([
    { id: 'fast', name: 'Fast' },
    { id: 'deep', name: 'Deep' }
  ])
})

test('a session without the option offers no choice', () => {
  expect(sessionChoice({ configOptions: MODEL_OPTIONS }, 'thought_level')).toBeNull()
  expect(sessionChoice({ configOptions: null }, 'model')).toBeNull()
  expect(sessionChoice({}, 'model')).toBeNull()
})

test('choosing sets the option by the agent’s own ID', async () => {
  const fake = requests()
  const chosen = await chooseSessionOption(
    fake,
    'session',
    { configOptions: GROUPED },
    'thought_level',
    'low'
  )
  expect(chosen).toBe(true)
  expect(fake.configured).toEqual([
    { sessionId: 'session', configId: 'reasoning_effort', value: 'low' }
  ])
})

test('a value the session already has is not set again', async () => {
  const fake = requests()
  expect(
    await chooseSessionOption(fake, 'session', { configOptions: MODEL_OPTIONS }, 'model', 'default')
  ).toBe(true)
  expect(fake.configured).toEqual([])
})

test('a session that offers no such option is left alone', async () => {
  const fake = requests()
  expect(await chooseSessionOption(fake, 'session', {}, 'model', 'opus')).toBe(false)
  expect(fake.configured).toEqual([])
})
