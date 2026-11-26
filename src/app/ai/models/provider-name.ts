import { acpAgentFor, AI_PROVIDERS, providerKind } from '@open-pencil/core/constants'

/** Display name for a provider, agent, or the Pi harness. */
export function modelProviderName(providerID: string): string {
  if (providerKind(providerID) === 'harness') return 'Pi'
  if (providerKind(providerID) === 'acp') return acpAgentFor(providerID)?.name ?? providerID
  return AI_PROVIDERS.find((provider) => provider.id === providerID)?.name ?? providerID
}
