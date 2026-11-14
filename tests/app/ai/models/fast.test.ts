import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import type { LanguageModel } from 'ai'

import { asDouble } from '@open-pencil/test-support/doubles'

import { summaryModel } from '@/app/ai/chat/compaction/model'
import { modelSettingsSnapshot, replaceAIModelSettings } from '@/app/ai/models'
import { fastTasksRuntime } from '@/app/ai/models/fast'
import type { AIModelRuntime } from '@/app/ai/models/runtime'
import type { AIModelRoleAssignment, AIModelSettings } from '@/app/ai/models/types'

let original: AIModelSettings
beforeEach(() => {
  original = modelSettingsSnapshot()
})
afterEach(() => {
  replaceAIModelSettings(original)
})

function assignFast(assignment: AIModelRoleAssignment): void {
  const settings = modelSettingsSnapshot()
  replaceAIModelSettings({
    ...settings,
    assignments: { ...settings.assignments, fast: assignment }
  })
}

const fastRuntime = asDouble<AIModelRuntime>({ kind: 'direct', model: asDouble<LanguageModel>({}) })

describe('the Fast tasks model', () => {
  test.each(['design', null] as const)(
    'is none while Fast tasks is %p, so fast work stays as it is',
    async (assignment) => {
      assignFast(assignment)
      let asked = 0
      const runtime = await fastTasksRuntime(async () => {
        asked++
        return fastRuntime
      })
      expect(runtime).toBeNull()
      expect(asked).toBe(0)
    }
  )

  test('is the model assigned to Fast tasks itself', async () => {
    assignFast('model-fast')
    const roles: string[] = []
    const runtime = await fastTasksRuntime(async (role) => {
      roles.push(role)
      return fastRuntime
    })
    expect(runtime).toBe(fastRuntime)
    expect(roles).toEqual(['fast'])
  })

  test('is none when the assigned model cannot be reached, instead of failing the work', async () => {
    assignFast('model-fast')
    const runtime = await fastTasksRuntime(async () => {
      throw new Error('Credential is unavailable')
    })
    expect(runtime).toBeNull()
  })
})

describe('the model that writes a conversation’s summaries', () => {
  const conversationModel = asDouble<LanguageModel>({})

  test('is the Fast tasks model when that is an API model', async () => {
    expect(await summaryModel(conversationModel, async () => fastRuntime)).toBe(
      fastRuntime.kind === 'direct' ? fastRuntime.model : conversationModel
    )
  })

  test('is the conversation’s own when no model is assigned to Fast tasks', async () => {
    expect(await summaryModel(conversationModel, async () => null)).toBe(conversationModel)
  })

  test('is the conversation’s own when a coding agent holds Fast tasks', async () => {
    const agent = asDouble<AIModelRuntime>({ kind: 'acp' })
    expect(await summaryModel(conversationModel, async () => agent)).toBe(conversationModel)
  })
})
