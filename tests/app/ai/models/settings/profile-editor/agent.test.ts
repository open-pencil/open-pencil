import { afterEach, describe, expect, test } from 'bun:test'

import { effectScope, nextTick, reactive, type EffectScope } from 'vue'

import type { AgentOffer } from '@/app/ai/agents/acp/oneoff'
import type { AIModelProfileDraft } from '@/app/ai/models'
import {
  useAgentModelSelection,
  type AgentModelSource
} from '@/app/ai/models/settings/profile-editor/agent'
import { createModelProfileDraft } from '@/app/ai/models/store'
import { createDeferred, type Deferred } from '@/app/runtime/deferred'

const CLAUDE = 'acp:claude-code'
const CODEX = 'acp:codex'

const claudeModels: AgentOffer = {
  imageInput: true,
  models: [
    { id: 'default', name: 'Default' },
    { id: 'opus', name: 'Opus' }
  ]
}

/** Agents that answer when the test says so, and the agents each read asked about. */
function agents(available = true) {
  const answers: Deferred<AgentOffer>[] = []
  const asked: string[] = []
  const source: AgentModelSource = {
    available: () => available,
    read: (agent) => {
      asked.push(agent.id)
      const next = createDeferred<AgentOffer>()
      answers.push(next)
      return next.promise
    }
  }
  return { source, answers, asked }
}

const scopes: EffectScope[] = []
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
})

function selectionFor(providerID: AIModelProfileDraft['providerID'], source: AgentModelSource) {
  const draft = reactive({ ...createModelProfileDraft(), providerID })
  const scope = effectScope()
  scopes.push(scope)
  const selection = scope.run(() => useAgentModelSelection(draft, source))
  if (!selection) throw new Error('The selection did not start.')
  return { draft, selection }
}

describe('the models of the agent a draft uses', () => {
  test('are read once the draft uses an ACP agent, with whether it takes images', async () => {
    const { source, answers, asked } = agents()
    const { selection } = selectionFor(CLAUDE, source)
    expect(selection.state.value).toBe('loading')
    answers[0]?.resolve(claudeModels)
    await nextTick()
    await nextTick()
    expect(asked).toEqual(['claude-code'])
    expect(selection.state.value).toBe('ready')
    expect(selection.models.value).toEqual([
      { id: 'default', name: 'Default' },
      { id: 'opus', name: 'Opus' }
    ])
    expect(selection.imageInput.value).toBe(true)
  })

  test('start no agent for other providers, or away from the desktop app', () => {
    const desktop = agents()
    expect(selectionFor('anthropic', desktop.source).selection.state.value).toBe('idle')
    expect(selectionFor('harness:pi', desktop.source).selection.state.value).toBe('idle')
    const browser = agents(false)
    expect(selectionFor(CLAUDE, browser.source).selection.state.value).toBe('idle')
    expect([...desktop.asked, ...browser.asked]).toEqual([])
  })

  test('can be read again after a failure, which leaves the draft as it was', async () => {
    const { source, answers } = agents()
    const { draft, selection } = selectionFor(CLAUDE, source)
    draft.modelID = 'opus'
    answers[0]?.reject(new Error('not signed in'))
    await nextTick()
    await nextTick()
    expect(selection.state.value).toBe('failed')
    expect(selection.models.value).toEqual([])
    expect(draft.modelID).toBe('opus')

    const retrying = selection.retry()
    expect(selection.state.value).toBe('loading')
    answers[1]?.resolve(claudeModels)
    await retrying
    expect(selection.state.value).toBe('ready')
  })

  test('follow the agent the draft uses, and ignore the answer of the one it left', async () => {
    const { source, answers } = agents()
    const { draft, selection } = selectionFor(CLAUDE, source)
    draft.providerID = CODEX
    await nextTick()
    answers[1]?.resolve({ imageInput: false, models: [] })
    answers[0]?.resolve(claudeModels)
    await nextTick()
    await nextTick()
    expect(selection.models.value).toEqual([])
    expect(selection.imageInput.value).toBe(false)

    draft.providerID = 'anthropic'
    await nextTick()
    expect(selection.state.value).toBe('idle')
    expect(selection.imageInput.value).toBeNull()
  })

  test('are not applied once the editor has closed', async () => {
    const { source, answers } = agents()
    const { selection } = selectionFor(CLAUDE, source)
    for (const scope of scopes.splice(0)) scope.stop()
    answers[0]?.resolve(claudeModels)
    await nextTick()
    await nextTick()
    expect(selection.models.value).toEqual([])
    expect(selection.state.value).toBe('loading')
  })
})
