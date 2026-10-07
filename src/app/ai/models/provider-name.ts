import { ACP_AGENTS, AI_PROVIDERS, HARNESS_PROVIDER_ID } from '@open-pencil/core/constants'

/** Display name for a provider, agent, or the Pi harness. */
export function modelProviderName(providerID: string): string {
  if (providerID === HARNESS_PROVIDER_ID) return 'Pi'
  if (providerID.startsWith('acp:')) {
    const agentID = providerID.slice('acp:'.length)
    return ACP_AGENTS.find((agent) => agent.id === agentID)?.name ?? providerID
  }
  return AI_PROVIDERS.find((provider) => provider.id === providerID)?.name ?? providerID
}
