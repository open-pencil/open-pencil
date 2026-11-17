import { mapValues, omit, pickBy } from 'es-toolkit'
import { computed, shallowRef } from 'vue'

import { acpAgentFor } from '@open-pencil/core/constants'

import { agentModelChoicesOffered } from '@/app/ai/agents/acp/offers'
import type {
  AgentChoiceCategory,
  AgentChoices,
  AgentModelChoices
} from '@/app/ai/agents/acp/options'
import { designModelProfile, resolveAIModelRole } from '@/app/ai/models'
import { profileModelID } from '@/app/ai/models/language-model'
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

/**
 * The composer's choices of an ACP agent's options, for the Design profile and model they were
 * made for. Each model offers its own efforts, so another model drops the effort; modes stay.
 */
const composerChoices = shallowRef<{
  profileId: AIModelProfileId | null
  modelID: string
  choices: AgentChoices
}>({ profileId: null, modelID: '', choices: {} })

function designModelID(): string {
  const profile = designModelProfile.value
  return profile ? profileModelID(profile) : ''
}

/** The composer's choices that still apply to the Design profile and its model. */
function composerOwn(): AgentChoices {
  const composer = composerChoices.value
  if (composer.profileId !== (designModelProfile.value?.id ?? null)) return {}
  if (composer.modelID === designModelID()) return composer.choices
  return omit(composer.choices, ['thought_level'])
}

/**
 * The effort and modes the next message to an ACP agent runs on, by the agent's own values;
 * absent ones keep the agent's. The profile names them until the composer chooses others.
 */
export const chatAgentChoices = computed<AgentChoices>(() => ({
  ...designModelProfile.value?.agentChoices,
  ...composerOwn()
}))

/** Chooses Design agent options for the next messages, as the composer does. */
export function chooseAgentOptions(choices: AgentChoices): void {
  composerChoices.value = {
    profileId: designModelProfile.value?.id ?? null,
    modelID: designModelID(),
    choices: { ...composerOwn(), ...choices }
  }
}

export function chooseAgentOption(category: AgentChoiceCategory, value: string): void {
  chooseAgentOptions({ [category]: value })
}

/**
 * What the open agent session offers to choose, as its transport reports it, with the profile and
 * model it started from; null without one. A session of another profile or model offers other
 * choices.
 */
export const agentSessionChoices = shallowRef<{
  profileId: AIModelProfileId
  modelID: string
  choices: AgentModelChoices
  /** The agent's own values, from the options the chat left to it when the session opened. */
  defaults: AgentChoices
} | null>(null)

/** The open session's choices while it runs the Design profile on that profile's model. */
function designSessionChoices(profileId: AIModelProfileId) {
  const session = agentSessionChoices.value
  return session?.profileId === profileId && session.modelID === designModelID() ? session : null
}

/**
 * The values the Design agent runs on when the chat names none: as its model offered them when
 * the profile read it, or else as the open session reported them. The composer marks a choice that
 * differs from these.
 */
export const chatAgentDefaults = computed<AgentChoices>(() => {
  const role = resolveAIModelRole('design')
  const agent = role && acpAgentFor(role.connection.providerID)
  if (!role || !agent) return {}
  const offered = agentModelChoicesOffered(agent, designModelID())
  return {
    ...designSessionChoices(role.profile.id)?.defaults,
    ...pickBy(
      mapValues(offered ?? {}, (choice) => choice?.current),
      Boolean
    )
  }
})

/**
 * What the composer offers to choose for the Design agent: the open session's options, or before
 * it opens, the ones its model offered when the profile chose it. Options without values are left
 * out; null for other providers.
 */
export const chatAgentOptions = computed<AgentModelChoices | null>(() => {
  const role = resolveAIModelRole('design')
  const agent = role && acpAgentFor(role.connection.providerID)
  if (!role || !agent) return null
  const offered =
    designSessionChoices(role.profile.id)?.choices ??
    agentModelChoicesOffered(agent, designModelID())
  return offered && pickBy(offered, (choice) => (choice?.values.length ?? 0) > 0)
})
