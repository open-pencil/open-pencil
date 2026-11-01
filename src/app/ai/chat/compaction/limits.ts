import { computedAsync } from '@vueuse/core'
import type { UIMessage } from 'ai'
import { computed, type Ref } from 'vue'

import { contextTokensOf } from '@/app/ai/chat/metadata'
import { resolveModelsDevModel } from '@/app/ai/models/catalog'
import { resolveLanguageModelID } from '@/app/ai/models/language-model'
import { resolveProviderModel } from '@/app/ai/models/reasoning/floors'
import { designModelConnection, designModelProfile } from '@/app/ai/models/store'

import { compactionOf, messagesSinceCompaction } from './marker'

/** What a model can hold, prompt and reply together, and how much of it a reply may take. */
export interface ContextLimits {
  contextWindow: number
  maxOutputTokens: number
}

/**
 * The Design model's limits, when the conversation runs on a model the chat calls itself and
 * its catalog gives a window. Agents keep their own context.
 */
export async function designContextLimits(): Promise<ContextLimits | null> {
  const profile = designModelProfile.value
  const providerID = designModelConnection.value?.providerID
  if (!profile || !providerID || providerID.startsWith('acp:') || providerID === 'harness:pi')
    return null
  const modelID = resolveLanguageModelID({
    providerID,
    modelID: profile.modelID,
    customModelID: profile.customModelID
  })
  const listed = await resolveProviderModel(providerID, modelID)
  const contextWindow =
    listed?.contextWindow ?? (await resolveModelsDevModel(providerID, modelID))?.contextWindow
  return contextWindow ? { contextWindow, maxOutputTokens: profile.maxOutputTokens } : null
}

/**
 * Where automatic compaction starts: the window less room for the reply, of which a tenth is
 * left for the next message, so the request that would overflow is never sent.
 */
export function autoCompactAt({ contextWindow, maxOutputTokens }: ContextLimits): number {
  const reply = Math.min(maxOutputTokens, contextWindow / 4)
  return Math.floor((contextWindow - reply) * 0.9)
}

/** About four characters to a token, for a summary no request has counted yet. */
const CHARACTERS_PER_TOKEN = 4

/**
 * The tokens the next request starts from: what the last reply since the latest compaction
 * reported, or, right after a compaction, an estimate of its summary.
 */
export function contextTokensSinceCompaction(messages: readonly UIMessage[]): number | null {
  const since = messagesSinceCompaction(messages)
  const reported = contextTokensOf(since)
  if (reported !== null) return reported
  const compaction = since.at(0) ? compactionOf(since[0]) : null
  return compaction ? Math.ceil(compaction.summary.length / CHARACTERS_PER_TOKEN) : null
}

/** How full the Design model's context is for `messages`, for the chat's context meter. */
export function useChatContext(messages: Ref<readonly UIMessage[]>) {
  const limits = computedAsync(
    () => {
      // Read before the await, so the meter follows a change of model.
      void designModelProfile.value?.modelID
      void designModelProfile.value?.customModelID
      void designModelConnection.value?.providerID
      return designContextLimits()
    },
    null,
    { onError: () => undefined }
  )
  const used = computed(() => contextTokensSinceCompaction(messages.value))
  const ratio = computed(() =>
    limits.value && used.value !== null ? used.value / limits.value.contextWindow : null
  )
  const compactsAt = computed(() => (limits.value ? autoCompactAt(limits.value) : null))
  return { limits, used, ratio, compactsAt }
}
