import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { acpAgentFor, type ACPAgentDef, type ModelOption } from '@open-pencil/core/constants'

import { readAgentModels, type AgentModelList } from '@/app/ai/agents/acp/oneoff'
import type { AIModelProfileDraft } from '@/app/ai/models'
import { canRunHostProcesses } from '@/app/tauri/capabilities'

/** Where reading an agent's models stands while a draft uses one: not started, or loading, read, or failed. */
export type AgentModelSelectionState = 'idle' | 'loading' | 'ready' | 'failed'

/** Where the models an agent offers come from, which tests replace. */
export interface AgentModelSource {
  /** Agents run as processes of the desktop app only. */
  available: () => boolean
  read: (agent: ACPAgentDef) => Promise<AgentModelList>
}

export const HOST_AGENT_MODELS: AgentModelSource = {
  available: canRunHostProcesses,
  read: readAgentModels
}

/**
 * The models an ACP agent offers while a draft uses it, read by starting the agent once each time
 * the draft changes to one, and whether it takes images. Reading fails quietly: the draft keeps
 * the model it names, and the person can retry or type a model ID.
 */
export function useAgentModelSelection(
  draft: AIModelProfileDraft,
  source: AgentModelSource = HOST_AGENT_MODELS
) {
  const agent = computed(() => acpAgentFor(draft.providerID))
  const models = ref<ModelOption[]>([])
  /** Null until the agent said, and while it is read again. */
  const imageInput = ref<boolean | null>(null)
  const state = ref<AgentModelSelectionState>('idle')
  // An answer belongs to the read that asked for it, so a later change or close drops it.
  let reading = 0

  async function read(): Promise<void> {
    const current = agent.value
    const request = ++reading
    models.value = []
    imageInput.value = null
    if (!current || !source.available()) {
      state.value = 'idle'
      return
    }
    state.value = 'loading'
    try {
      const list = await source.read(current)
      if (request !== reading) return
      models.value = list.models?.options ?? []
      imageInput.value = list.imageInput
      state.value = 'ready'
    } catch {
      if (request === reading) state.value = 'failed'
    }
  }

  watch(agent, read, { immediate: true })
  tryOnScopeDispose(() => {
    reading++
  })

  return { models, imageInput, state, retry: read }
}
