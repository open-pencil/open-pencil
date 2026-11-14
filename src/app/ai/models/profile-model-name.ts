import { acpAgentFor, AI_PROVIDERS } from '@open-pencil/core/constants'

import { agentModelName } from '@/app/ai/agents/acp/offers'
import { agentModelID } from '@/app/ai/models/agent'
import { modelConnection } from '@/app/ai/models/store'
import type { AIModelProfile } from '@/app/ai/models/types'

/**
 * The model a profile names, as a person reads it: the catalog's name for a provider's model, the
 * name a coding agent gives its own, and otherwise the ID. Empty for an agent profile that leaves
 * the choice to the agent.
 */
export function profileModelName(profile: AIModelProfile): string {
  const providerID = modelConnection(profile.connectionId)?.providerID
  const modelID = agentModelID(profile)
  if (!providerID || !modelID) return modelID
  const agent = acpAgentFor(providerID)
  if (agent) return agentModelName(agent, modelID) ?? modelID
  const provider = AI_PROVIDERS.find((candidate) => candidate.id === providerID)
  return provider?.models.find((model) => model.id === modelID)?.name ?? modelID
}
