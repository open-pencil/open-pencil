import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { acpAgentFor, type ACPAgentDef, type ModelOption } from '@open-pencil/core/constants'

import {
  rememberAgentOffer,
  rememberedAgentOffer,
  type RememberedAgentOffer
} from '@/app/ai/agents/acp/offers'
import { readAgentChoices, readAgentOffer, type AgentOffer } from '@/app/ai/agents/acp/oneoff'
import type { AgentModelChoices } from '@/app/ai/agents/acp/options'
import type { AIModelProfileDraft } from '@/app/ai/models'
import { canRunHostProcesses } from '@/app/tauri/capabilities'

/** Where reading an agent's models stands while a draft uses one: not started, or loading, read, or failed. */
export type AgentModelSelectionState = 'idle' | 'loading' | 'ready' | 'failed'

/** Where the models an agent offers come from, which tests replace. */
export interface AgentModelSource {
  /** Agents run as processes of the desktop app only. */
  available: () => boolean
  read: (agent: ACPAgentDef) => Promise<AgentOffer>
  /** The effort and modes one model offers, read when a draft chooses a model not read yet. */
  readChoices?: (agent: ACPAgentDef, model: string) => Promise<AgentModelChoices>
  /** What the agent offered last time, shown at once; left out, the agent is always asked. */
  remembered?: (agent: ACPAgentDef) => Promise<RememberedAgentOffer | null>
  remember?: (agent: ACPAgentDef, offer: AgentOffer) => Promise<void>
}

export const HOST_AGENT_MODELS: AgentModelSource = {
  available: canRunHostProcesses,
  read: readAgentOffer,
  readChoices: (agent, model) => readAgentChoices(agent, model),
  remembered: rememberedAgentOffer,
  remember: rememberAgentOffer
}

/**
 * The models an ACP agent offers while a draft uses it, whether it takes images, and the efforts
 * and modes of the draft's model. What the agent offered last time shows at once; the agent is
 * started to ask only when nothing recent is remembered, on a retry, or for a model never read.
 * Reading fails quietly: the draft keeps the model, effort, and modes it names, and the person can
 * retry or type a model ID. A typed model's choices are not read, so it keeps the agent's own.
 */
export function useAgentModelSelection(
  draft: AIModelProfileDraft,
  source: AgentModelSource = HOST_AGENT_MODELS
) {
  const agent = computed(() => acpAgentFor(draft.providerID))
  const offer = ref<AgentOffer | null>(null)
  const models = computed<ModelOption[]>(() => offer.value?.models ?? [])
  /** Null until the agent said, and while it is read again. */
  const imageInput = computed(() => offer.value?.imageInput ?? null)
  const state = ref<AgentModelSelectionState>('idle')
  /** The model whose effort and modes the draft chooses from; null for a typed model ID. */
  const choicesModel = computed(() => (draft.customModelID.trim() ? null : draft.modelID))
  /** The effort and modes of the draft's model; null until read, or for a typed model ID. */
  const choices = computed<AgentModelChoices | null>(() => {
    const model = choicesModel.value
    return model === null ? null : (offer.value?.choices[model] ?? null)
  })
  const choicesState = ref<AgentModelSelectionState>('idle')
  // An answer belongs to the read that asked for it, so a later change or close drops it.
  let reading = 0
  let readingChoices = 0

  function show(next: AgentOffer): void {
    offer.value = next
    state.value = 'ready'
  }

  /** `again` asks the agent even when its last offer is recent. */
  async function read(again = false): Promise<void> {
    const current = agent.value
    const request = ++reading
    offer.value = null
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

  /** Reads the choices of the draft's model once the agent's offer shows it has not read them. */
  async function readChoices(): Promise<void> {
    const current = agent.value
    const model = choicesModel.value
    const shown = offer.value
    const request = ++readingChoices
    if (!current || !shown || model === null || model in shown.choices || !source.readChoices) {
      choicesState.value = shown && model !== null && model in shown.choices ? 'ready' : 'idle'
      return
    }
    choicesState.value = 'loading'
    try {
      const read = await source.readChoices(current, model)
      if (request !== readingChoices || offer.value !== shown) return
      const next = { ...shown, choices: { ...shown.choices, [model]: read } }
      offer.value = next
      choicesState.value = 'ready'
      void source.remember?.(current, next)
    } catch {
      if (request === readingChoices) choicesState.value = 'failed'
    }
  }

  watch(agent, () => read(), { immediate: true })
  watch([offer, choicesModel], () => readChoices())
  tryOnScopeDispose(() => {
    reading++
    readingChoices++
  })

  return {
    models,
    imageInput,
    state,
    choices,
    choicesState,
    retry: () => read(true)
  }
}
