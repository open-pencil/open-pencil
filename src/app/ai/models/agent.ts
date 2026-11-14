import { providerKind, type AIProviderID } from '@open-pencil/core/constants'

import type { AIModelCapability, AIModelProfile } from './types'

/** ACP coding agents and Pi, which run on this computer and bring their own models. */
export function isAgentProvider(providerID: AIProviderID): boolean {
  return providerKind(providerID) !== 'api'
}

/**
 * Whether a prompt to the provider's agent can carry images: an ACP prompt has image blocks, and
 * the Harness companion's turn is text alone. An ACP agent says for itself whether it reads them.
 */
export function agentPromptsCarryImages(providerID: AIProviderID): boolean {
  return providerKind(providerID) === 'acp'
}

/**
 * What an agent's profile can do: it always has tools, and image input when the profile declares
 * it and a prompt to the agent can carry images.
 */
export function agentCapabilities(
  providerID: AIProviderID,
  requested: readonly AIModelCapability[]
): AIModelCapability[] {
  return agentPromptsCarryImages(providerID) && requested.includes('vision')
    ? ['tools', 'vision']
    : ['tools']
}

/** The model an agent's profile names, as the agent knows it; empty keeps the agent's own. */
export function agentModelID(profile: Pick<AIModelProfile, 'modelID' | 'customModelID'>): string {
  return profile.customModelID.trim() || profile.modelID.trim()
}
