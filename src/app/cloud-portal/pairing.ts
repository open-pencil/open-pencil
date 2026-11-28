import {
  CLOUD_AGENT_PAIRING_PAGE,
  CLOUD_OAUTH_AUTHORIZE_PAGE,
  type CloudDiscovery
} from '@open-pencil/cloud/contract'

/** Whether the server pairs an agent that signs in with an editor used without an account. */
export function pairsAgents({ capabilities, localEditor }: CloudDiscovery): boolean {
  return capabilities.apps && capabilities.agents && localEditor
}

/** The pairing page for the app's request that signing in goes on to, or null for anything else. */
export function pairingPathFor(redirect: string): string | null {
  const [path, query] = redirect.split('?', 2)
  return path === CLOUD_OAUTH_AUTHORIZE_PAGE && query
    ? `${CLOUD_AGENT_PAIRING_PAGE}?${query}`
    : null
}
