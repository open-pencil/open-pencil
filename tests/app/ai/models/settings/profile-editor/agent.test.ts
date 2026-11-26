import { afterEach, describe, expect, test } from 'bun:test'

import { effectScope, nextTick, reactive, type EffectScope } from 'vue'

import { createDeferred, type Deferred } from '@open-pencil/std/async'

import type { AgentOffer } from '@/app/ai/agents/acp/oneoff'
import type { AIModelProfileDraft } from '@/app/ai/models'
import {
  useAgentModelSelection,
  type AgentModelSource
} from '@/app/ai/models/settings/profile-editor/agent'
import { createModelProfileDraft } from '@/app/ai/models/store'

const CLAUDE = 'acp:claude-code'
const CODEX = 'acp:codex'

const claudeModels: AgentOffer = {
  imageInput: true,
  models: [
    { id: 'default', name: 'Default' },
    { id: 'opus', name: 'Opus' }
  ],
  choices: {}
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
    answers[1]?.resolve({ imageInput: false, models: [], choices: {} })
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

  describe('when the agent’s last offer is remembered', () => {
    const olderModels: AgentOffer = {
      imageInput: false,
      models: [{ id: 'default', name: 'Default' }],
      choices: {}
    }
    /** Agents whose last offer is `offer`, and the offers kept for next time. */
    function remembering(offer: AgentOffer, fresh: boolean) {
      const base = agents()
      const kept: AgentOffer[] = []
      const source: AgentModelSource = {
        ...base.source,
        remembered: async () => ({ offer, fresh }),
        remember: async (_agent, next) => {
          kept.push(next)
        }
      }
      return { ...base, source, kept }
    }

    /** The remembered offer is read from storage, which answers after the selection starts. */
    async function remembered(): Promise<void> {
      await Promise.resolve()
      await Promise.resolve()
      await nextTick()
    }

    test('a recent one shows at once and starts no agent', async () => {
      const { source, asked } = remembering(claudeModels, true)
      const { selection } = selectionFor(CLAUDE, source)
      await remembered()
      expect(selection.state.value).toBe('ready')
      expect(selection.models.value).toEqual(claudeModels.models)
      expect(selection.imageInput.value).toBe(true)
      expect(asked).toEqual([])
    })

    test('an older one shows while the agent is asked again, and the answer is kept', async () => {
      const { source, answers, asked, kept } = remembering(olderModels, false)
      const { selection } = selectionFor(CLAUDE, source)
      await remembered()
      expect(selection.state.value).toBe('ready')
      expect(selection.models.value).toEqual(olderModels.models)
      expect(asked).toEqual(['claude-code'])
      answers[0]?.resolve(claudeModels)
      await nextTick()
      await nextTick()
      expect(selection.models.value).toEqual(claudeModels.models)
      expect(selection.imageInput.value).toBe(true)
      expect(kept).toEqual([claudeModels])
    })

    test('an older one stays when the agent cannot be asked again', async () => {
      const { source, answers } = remembering(olderModels, false)
      const { selection } = selectionFor(CLAUDE, source)
      await remembered()
      answers[0]?.reject(new Error('The agent did not start.'))
      await nextTick()
      await nextTick()
      expect(selection.state.value).toBe('ready')
      expect(selection.models.value).toEqual(olderModels.models)
    })

    test('a retry asks the agent even when its offer is recent', async () => {
      const { source, answers, asked } = remembering(olderModels, true)
      const { selection } = selectionFor(CLAUDE, source)
      await remembered()
      const retried = selection.retry()
      expect(asked).toEqual(['claude-code'])
      answers[0]?.resolve(claudeModels)
      await retried
      expect(selection.models.value).toEqual(claudeModels.models)
    })
  })
})

describe('the effort and modes of the model a draft uses', () => {
  const opusChoices = {
    thought_level: {
      name: 'Effort',
      current: 'default',
      values: [
        { id: 'default', name: 'Default' },
        { id: 'max', name: 'Max' }
      ]
    },
    mode: { name: 'Mode', current: 'default', values: [{ id: 'plan', name: 'Plan' }] }
  }

  /** An agent whose offer lists models only, and that answers each model's read at once. */
  function choicesAgent() {
    const asked: string[] = []
    const kept: AgentOffer[] = []
    const source: AgentModelSource = {
      available: () => true,
      read: async () => ({ ...claudeModels, choices: { '': opusChoices } }),
      readChoices: async (_agent, model) => {
        asked.push(model)
        return opusChoices
      },
      remember: async (_agent, offer) => {
        kept.push(offer)
      }
    }
    return { source, asked, kept }
  }

  async function settled(): Promise<void> {
    for (let i = 0; i < 4; i++) await nextTick()
  }

  test('come with the offer for the agent’s own model, without another read', async () => {
    const { source, asked } = choicesAgent()
    const { selection } = selectionFor(CLAUDE, source)
    await settled()
    expect(selection.choices.value).toEqual(opusChoices)
    expect(asked).toEqual([])
  })

  test('are read once for a chosen model, and kept with the agent’s offer', async () => {
    const { source, asked, kept } = choicesAgent()
    const { draft, selection } = selectionFor(CLAUDE, source)
    await settled()
    draft.modelID = 'opus'
    await settled()
    expect(asked).toEqual(['opus'])
    expect(selection.choices.value).toEqual(opusChoices)
    expect(selection.choicesState.value).toBe('ready')
    expect(kept.at(-1)?.choices).toEqual({ '': opusChoices, opus: opusChoices })

    draft.modelID = ''
    await settled()
    draft.modelID = 'opus'
    await settled()
    expect(asked).toEqual(['opus'])
  })

  test('are not read for a model ID the person types', async () => {
    const { source, asked } = choicesAgent()
    const { draft, selection } = selectionFor(CLAUDE, source)
    await settled()
    draft.customModelID = 'opus-preview'
    await settled()
    expect(asked).toEqual([])
    expect(selection.choices.value).toBeNull()
  })
})
