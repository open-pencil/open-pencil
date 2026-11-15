import { computed, shallowRef } from 'vue'

import { acpAgentFor } from '@open-pencil/core/constants'

import { agentModelEfforts } from '@/app/ai/agents/acp/offers'
import type { AgentEfforts } from '@/app/ai/agents/acp/options'
import { designModelProfile, resolveAIModelRole } from '@/app/ai/models'
import type { AIModelProfileId, ThinkingLevel } from '@/app/ai/models/types'

/** The composer's choice applies to the Design profile it was made for; switching profiles drops it. */
const composerChoice = shallowRef<{
  profileId: AIModelProfileId | null
  level: ThinkingLevel
} | null>(null)

/** The level the next direct-model message uses. */
export const chatThinkingLevel = computed<ThinkingLevel>({
  get: () => {
    const profile = designModelProfile.value
    const choice = composerChoice.value
    if (choice?.profileId === (profile?.id ?? null)) return choice.level
    return profile?.thinkingLevel ?? 'default'
  },
  set: (level) => {
    composerChoice.value = { profileId: designModelProfile.value?.id ?? null, level }
  }
})

/** The composer's choice of an ACP agent's effort, for the Design profile it was made for. */
const composerEffort = shallowRef<{ profileId: AIModelProfileId | null; effort: string } | null>(
  null
)

/**
 * The effort the next message to an ACP agent runs on, by the agent's own value; empty keeps the
 * agent's. The profile names it until the composer chooses another.
 */
export const chatAgentEffort = computed<string>({
  get: () => {
    const profile = designModelProfile.value
    const choice = composerEffort.value
    if (choice?.profileId === (profile?.id ?? null)) return choice.effort
    return profile?.agentEffort ?? ''
  },
  set: (effort) => {
    composerEffort.value = { profileId: designModelProfile.value?.id ?? null, effort }
  }
})

/** The efforts the open agent session offers, as its transport reports them; null without one. */
export const agentSessionEfforts = shallowRef<AgentEfforts | null>(null)

/**
 * The efforts the composer offers for the Design agent: the open session's, or before it opens,
 * the ones its model offered when the profile chose it. Null for other providers and models that
 * offer none.
 */
export const chatAgentEfforts = computed<AgentEfforts | null>(() => {
  const role = resolveAIModelRole('design')
  const agent = role && acpAgentFor(role.connection.providerID)
  if (!role || !agent) return null
  const efforts =
    agentSessionEfforts.value ??
    agentModelEfforts(agent, role.profile.customModelID || role.profile.modelID)
  return efforts && efforts.values.length > 0 ? efforts : null
})
