import { pickBy } from 'es-toolkit'
import { computed, shallowRef } from 'vue'

import { acpAgentFor } from '@open-pencil/core/constants'

import { agentModelChoicesOffered } from '@/app/ai/agents/acp/offers'
import type {
  AgentChoiceCategory,
  AgentChoices,
  AgentModelChoices
} from '@/app/ai/agents/acp/options'
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

/** The composer's choices of an ACP agent's options, for the Design profile they were made for. */
const composerChoices = shallowRef<{ profileId: AIModelProfileId | null; choices: AgentChoices }>({
  profileId: null,
  choices: {}
})

/**
 * The effort and modes the next message to an ACP agent runs on, by the agent's own values;
 * absent ones keep the agent's. The profile names them until the composer chooses others.
 */
export const chatAgentChoices = computed<AgentChoices>(() => {
  const profile = designModelProfile.value
  const composer = composerChoices.value
  const own = composer.profileId === (profile?.id ?? null) ? composer.choices : {}
  return { ...profile?.agentChoices, ...own }
})

/** Chooses one of the Design agent's options for the next messages, as the composer does. */
export function chooseAgentOption(category: AgentChoiceCategory, value: string): void {
  const profileId = designModelProfile.value?.id ?? null
  const composer = composerChoices.value
  const kept = composer.profileId === profileId ? composer.choices : {}
  composerChoices.value = { profileId, choices: { ...kept, [category]: value } }
}

/**
 * What the open agent session offers to choose, as its transport reports it, with the profile it
 * started from; null without one. A session of another profile, which may be another agent or
 * model, offers other choices.
 */
export const agentSessionChoices = shallowRef<{
  profileId: AIModelProfileId
  choices: AgentModelChoices
} | null>(null)

/**
 * What the composer offers to choose for the Design agent: the open session's options, or before
 * it opens, the ones its model offered when the profile chose it. Options without values are left
 * out; null for other providers.
 */
export const chatAgentOptions = computed<AgentModelChoices | null>(() => {
  const role = resolveAIModelRole('design')
  const agent = role && acpAgentFor(role.connection.providerID)
  if (!role || !agent) return null
  const session = agentSessionChoices.value
  const offered =
    (session?.profileId === role.profile.id ? session.choices : null) ??
    agentModelChoicesOffered(agent, role.profile.customModelID || role.profile.modelID)
  return offered && pickBy(offered, (choice) => (choice?.values.length ?? 0) > 0)
})
