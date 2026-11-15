import { acpAgentFor, AI_PROVIDERS, HARNESS_PROVIDER_ID } from '@open-pencil/core/constants'

/** Display name for a provider, agent, or the Pi harness. */
export function modelProviderName(providerID: string): string {
  if (providerID === HARNESS_PROVIDER_ID) return 'Pi'
  if (providerID.startsWith('acp:')) return acpAgentFor(providerID)?.name ?? providerID
  return AI_PROVIDERS.find((provider) => provider.id === providerID)?.name ?? providerID
}
