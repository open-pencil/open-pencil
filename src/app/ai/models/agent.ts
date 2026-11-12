import type { AIProviderID } from '@open-pencil/core/constants'

import type { AIModelCapability, AIModelProfile } from './types'

/** ACP coding agents and Pi, which run on this computer and bring their own models. */
export function isAgentProvider(providerID: AIProviderID): boolean {
  return providerID.startsWith('acp:') || providerID === 'harness:pi'
}

/**
 * What an agent's profile can do: it always has tools, and only an ACP agent can take images,
 * since Pi's harness turn is text alone.
 */
export function agentCapabilities(
  providerID: AIProviderID,
  requested: readonly AIModelCapability[]
): AIModelCapability[] {
  return providerID.startsWith('acp:') && requested.includes('vision')
    ? ['tools', 'vision']
    : ['tools']
}

/** The model an agent's profile names, as the agent knows it; empty keeps the agent's own. */
export function agentModelID(profile: Pick<AIModelProfile, 'modelID' | 'customModelID'>): string {
  return profile.customModelID.trim() || profile.modelID.trim()
}
