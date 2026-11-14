import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { acpAgentFor, type ACPAgentDef, type ModelOption } from '@open-pencil/core/constants'

import {
  rememberAgentOffer,
  rememberedAgentOffer,
  type RememberedAgentOffer
} from '@/app/ai/agents/acp/offers'
import { readAgentOffer, type AgentOffer } from '@/app/ai/agents/acp/oneoff'
import type { AIModelProfileDraft } from '@/app/ai/models'
import { canRunHostProcesses } from '@/app/tauri/capabilities'

/** Where reading an agent's models stands while a draft uses one: not started, or loading, read, or failed. */
export type AgentModelSelectionState = 'idle' | 'loading' | 'ready' | 'failed'

/** Where the models an agent offers come from, which tests replace. */
export interface AgentModelSource {
  /** Agents run as processes of the desktop app only. */
  available: () => boolean
  read: (agent: ACPAgentDef) => Promise<AgentOffer>
  /** What the agent offered last time, shown at once; left out, the agent is always asked. */
  remembered?: (agent: ACPAgentDef) => Promise<RememberedAgentOffer | null>
  remember?: (agent: ACPAgentDef, offer: AgentOffer) => Promise<void>
}

export const HOST_AGENT_MODELS: AgentModelSource = {
  available: canRunHostProcesses,
  read: readAgentOffer,
  remembered: rememberedAgentOffer,
  remember: rememberAgentOffer
}

/**
 * The models an ACP agent offers while a draft uses it, and whether it takes images. What the
 * agent offered last time shows at once; the agent is started to ask only when nothing recent is
 * remembered, or on a retry. Reading fails quietly: the draft keeps the model it names, and the
 * person can retry or type a model ID.
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

  function show(offer: AgentOffer): void {
    models.value = offer.models
    imageInput.value = offer.imageInput
    state.value = 'ready'
  }

  /** `again` asks the agent even when its last offer is recent. */
  async function read(again = false): Promise<void> {
    const current = agent.value
    const request = ++reading
    models.value = []
    imageInput.value = null
    if (!current || !source.available()) {
      state.value = 'idle'
      return
    }
    let remembered: RememberedAgentOffer | null = null
    if (source.remembered && !again) {
      remembered = await source.remembered(current).catch(() => null)
      if (request !== reading) return
    }
    if (remembered) {
      show(remembered.offer)
      if (remembered.fresh) return
    } else {
      state.value = 'loading'
    }
    try {
      const offer = await source.read(current)
      if (request !== reading) return
      show(offer)
      void source.remember?.(current, offer)
    } catch {
      // An older offer stays on screen; only a read with nothing to show reports the failure.
      if (request === reading && !remembered) state.value = 'failed'
    }
  }

  watch(agent, () => read(), { immediate: true })
  tryOnScopeDispose(() => {
    reading++
  })

  return { models, imageInput, state, retry: () => read(true) }
}
