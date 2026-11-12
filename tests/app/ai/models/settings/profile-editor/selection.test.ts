import { afterEach, describe, expect, test } from 'bun:test'

import { effectScope, nextTick, reactive, ref, type EffectScope } from 'vue'

import type { AgentModelList } from '@/app/ai/agents/acp/oneoff'
import type { AIModelProfileDraft } from '@/app/ai/models'
import type { AgentModelSource } from '@/app/ai/models/settings/profile-editor/agent'
import { useProfileModelSelection } from '@/app/ai/models/settings/profile-editor/selection'
import { createModelProfileDraft } from '@/app/ai/models/store'
import { createDeferred, type Deferred } from '@/app/runtime/deferred'

const labels = ref({
  recommendedModels: 'Recommended',
  latestModels: 'Latest',
  allModels: 'All models',
  latest: 'Latest',
  customModelGroup: 'Custom',
  customModel: 'Custom model…',
  agentDefaultModel: 'Agent default'
})

const claudeCode: AgentModelList = {
  imageInput: true,
  models: {
    current: 'default',
    options: [
      { id: 'default', name: 'Default' },
      { id: 'opus', name: 'Opus' },
      { id: 'sonnet', name: 'Sonnet' }
    ]
  }
}

const scopes: EffectScope[] = []
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
})

/** A profile editor's model selection, over an agent that answers when the test says so. */
function editor(overrides: Partial<AIModelProfileDraft> = {}) {
  const answers: Deferred<AgentModelList>[] = []
  const source: AgentModelSource = {
    available: () => true,
    read: () => {
      const next = createDeferred<AgentModelList>()
      answers.push(next)
      return next.promise
    }
  }
  const draft = reactive({ ...createModelProfileDraft(), ...overrides })
  const scope = effectScope()
  scopes.push(scope)
  const selection = scope.run(() => useProfileModelSelection(draft, labels, source))
  if (!selection) throw new Error('The selection did not start.')
  return {
    draft,
    selection,
    /** Picks a provider, which starts the agent's read once the editor reacts. */
    async choose(providerID: AIModelProfileDraft['providerID']) {
      selection.updateProvider(providerID)
      await nextTick()
    },
    /** Answers the latest read and lets the editor react. */
    async answer(list: AgentModelList) {
      answers.at(-1)?.resolve(list)
      await nextTick()
      await nextTick()
    },
    /** Picks an entry of the model picker by what it shows. */
    pick(label: string) {
      const option = selection.modelOptions.value.find((candidate) => candidate.label === label)
      if (!option) throw new Error(`The picker has no ${label}.`)
      selection.updateModel(option.value)
    },
    /** What the model picker shows as chosen. */
    shown: () =>
      selection.modelOptions.value.find(
        (option) => option.value === selection.selectedModelValue.value
      )?.label
  }
}

describe('a coding agent’s capabilities in the profile editor', () => {
  test('start as tools, and take image input from what the agent reports', async () => {
    const seeing = editor()
    await seeing.choose('acp:claude-code')
    expect(seeing.draft.capabilities).toEqual(['tools'])
    await seeing.answer(claudeCode)
    expect(seeing.draft.capabilities).toEqual(['tools', 'vision'])

    const blind = editor()
    await blind.choose('acp:claude-code')
    await blind.answer({ ...claudeCode, imageInput: false })
    expect(blind.draft.capabilities).toEqual(['tools'])
  })

  test('keep what the person set, and what a saved profile has', async () => {
    const chosen = editor()
    await chosen.choose('acp:claude-code')
    chosen.selection.visionEnabled.value = false
    await chosen.answer(claudeCode)
    expect(chosen.draft.capabilities).toEqual(['tools'])

    const saved = editor({ providerID: 'acp:claude-code', capabilities: ['tools'] })
    await nextTick()
    await saved.answer(claudeCode)
    expect(saved.draft.capabilities).toEqual(['tools'])
  })

  test('cannot gain image input the agent said it lacks, but may before it has said', async () => {
    const waiting = editor()
    await waiting.choose('acp:claude-code')
    waiting.selection.visionEnabled.value = true
    expect(waiting.draft.capabilities).toEqual(['tools', 'vision'])

    const blind = editor()
    await blind.choose('acp:claude-code')
    await blind.answer({ ...claudeCode, imageInput: false })
    blind.selection.visionEnabled.value = true
    expect(blind.draft.capabilities).toEqual(['tools'])
    expect(blind.selection.visionEnabled.value).toBe(false)
  })

  test('are tools alone for Pi, whatever the provider before it could do', async () => {
    const pi = editor({ providerID: 'anthropic', capabilities: ['tools', 'vision'] })
    await pi.choose('harness:pi')
    expect(pi.draft.capabilities).toEqual(['tools'])
  })
})

describe('the model of a coding agent’s profile in the editor', () => {
  test('is the agent’s default, one it lists, or an ID the person types', async () => {
    const agent = editor()
    await agent.choose('acp:claude-code')
    await agent.answer(claudeCode)

    agent.pick('Opus')
    expect(agent.draft).toMatchObject({ modelID: 'opus', customModelID: '' })
    agent.pick('Agent default')
    expect(agent.draft).toMatchObject({ modelID: '', customModelID: '' })
    agent.pick('Custom model…')
    expect(agent.selection.customModelSelected.value).toBe(true)
    expect(agent.selection.supportsCustomModel.value).toBe(true)
  })

  test('is the one the profile names, even while the agent’s list is still coming', async () => {
    const agent = editor({ providerID: 'acp:claude-code', modelID: 'sonnet' })
    await nextTick()
    expect(agent.shown()).toBe('sonnet')
    await agent.answer(claudeCode)
    expect(agent.shown()).toBe('Sonnet')
  })

  test('shows the agent’s default for a profile that names none', () => {
    expect(editor({ providerID: 'acp:claude-code' }).shown()).toBe('Agent default')
  })
})
