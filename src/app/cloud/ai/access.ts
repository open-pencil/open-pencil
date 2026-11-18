import { compact } from 'es-toolkit'
import { joinURL } from 'ufo'
import { computed } from 'vue'

import { createCloudServicesClient, type CloudServicesClient } from '@open-pencil/cloud/client'
import { CLOUD_ACCOUNT_PLAN_PATH, type WorkspaceSummary } from '@open-pencil/cloud/contract'

import { homeCloudServer } from '../servers/store'
import { cloudAPIClient, cloudConnection, cloudFetch } from '../sessions/connection'
import { createCloudTokenCache, type CloudTokenCache } from '../tokens'

export type CloudAIWorkspace = Pick<WorkspaceSummary, 'id' | 'name'>

/** The Home server's services, while someone is signed in there and it advertises them. */
const homeAI = computed(() => {
  const server = homeCloudServer.value
  if (!server) return null
  const connection = cloudConnection(server.id)
  const { discovery, account } = connection
  if (connection.state !== 'signed-in' || !discovery?.services || !account) return null
  return { server, discovery, account, endpoint: discovery.services.endpoint, connection }
})

export const cloudAIAvailable = computed(() => homeAI.value !== null)

/** Who uses the Home server's services, so answers for an earlier sign-in can be told apart. */
export const cloudAIIdentity = computed(() => {
  const home = homeAI.value
  return home ? `${home.server.id}:${home.account.id}` : null
})

/** Where people manage the plan that pays for AI: the Home server's plan page, when it bills. */
export const cloudBillingURL = computed(() => {
  const home = homeAI.value
  return home?.discovery.billing ? joinURL(home.server.url, CLOUD_ACCOUNT_PLAN_PATH) : null
})

// Keyed by account too, so a token signed for one person is never sent for another.
const tokenSources = new Map<string, CloudTokenCache>()

/** The Home server's services on a workspace's behalf, or `null` while it is unavailable. */
export function cloudAIClient(workspaceId: string): CloudServicesClient | null {
  const home = homeAI.value
  if (!home || !workspaceId) return null
  const key = `${cloudAIIdentity.value}:${workspaceId}`
  let tokens = tokenSources.get(key)
  if (!tokens) {
    const api = cloudAPIClient(home.server, home.discovery)
    tokens = createCloudTokenCache(() => api.requestServicesToken(workspaceId))
    tokenSources.set(key, tokens)
  }
  return createCloudServicesClient({ endpoint: home.endpoint, tokens, fetch: cloudFetch })
}

/**
 * The Home server's workspaces whose plan includes AI, in the order the server lists them. Rejects
 * when any check fails, since the failed workspace may be the one a profile already uses.
 */
export async function cloudAIWorkspaces(): Promise<CloudAIWorkspace[]> {
  const home = homeAI.value
  if (!home) return []
  const api = cloudAPIClient(home.server, home.discovery)
  const checks = await Promise.allSettled(
    home.connection.workspaces.map(async (workspace) => {
      const entitlements = await api.getWorkspaceEntitlements(workspace.id)
      return entitlements.features.cloudServices ? { id: workspace.id, name: workspace.name } : null
    })
  )
  const failure = checks.find((check) => check.status === 'rejected')
  if (failure) throw failure.reason
  return compact(checks.map((check) => (check.status === 'fulfilled' ? check.value : null)))
}

/**
 * Whether the signed-in account owns a workspace on the Home server, and so pays for its credits,
 * or `null` when unknown: a server too old to say, or a workspace it doesn't list.
 */
export function cloudOwnsWorkspace(workspaceId: string): boolean | null {
  const workspace = homeAI.value?.connection.workspaces.find(({ id }) => id === workspaceId)
  return workspace?.owner ?? null
}

/**
 * Drops the services token held for a workspace, so the next request signs one with the plan as
 * it is now: a token carries the allowance it was signed with.
 */
export function renewCloudAIToken(workspaceId: string): void {
  // Reset in place, since clients made earlier, such as a chat's, keep this same source.
  tokenSources.get(`${cloudAIIdentity.value}:${workspaceId}`)?.reset()
}

/**
 * The credits a workspace's plan grants each month, or `null` when it grants none, sets no limit,
 * or the server can't say.
 */
export async function cloudMonthlyAllowance(workspaceId: string): Promise<number | null> {
  const home = homeAI.value
  if (!home || !workspaceId) return null
  const entitlements = await cloudAPIClient(home.server, home.discovery)
    .getWorkspaceEntitlements(workspaceId)
    .catch(() => null)
  return entitlements?.features.cloudServices ? entitlements.limits.monthlyCreditAllowance : null
}
