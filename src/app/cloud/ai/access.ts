import { compact } from 'es-toolkit'
import { computed } from 'vue'

import {
  createCloudAIClient,
  type CloudAIClient,
  type CloudAITokenSource
} from '@open-pencil/cloud/client'
import type { WorkspaceSummary } from '@open-pencil/cloud/contract'

import { homeCloudServer } from '../servers/store'
import { cloudAPIClient, cloudConnection, cloudFetch } from '../sessions/connection'
import { createCloudAITokens } from './tokens'

export type CloudAIWorkspace = Pick<WorkspaceSummary, 'id' | 'name'>

/** The Home server's AI service, while someone is signed in there and it advertises one. */
const homeAI = computed(() => {
  const server = homeCloudServer.value
  if (!server) return null
  const connection = cloudConnection(server.id)
  const { discovery, account } = connection
  if (connection.state !== 'signed-in' || !discovery?.ai || !account) return null
  return { server, discovery, account, endpoint: discovery.ai.endpoint, connection }
})

export const cloudAIAvailable = computed(() => homeAI.value !== null)

/** Who uses the Home server's AI service, so answers for an earlier sign-in can be told apart. */
export const cloudAIIdentity = computed(() => {
  const home = homeAI.value
  return home ? `${home.server.id}:${home.account.id}` : null
})

/** Where people manage the plan that pays for AI, when the Home server bills. */
export const cloudBillingURL = computed(() => homeAI.value?.discovery.billing?.portalURL ?? null)

// Keyed by account too, so a token signed for one person is never sent for another.
const tokenSources = new Map<string, CloudAITokenSource>()

/** The Home server's AI service on a workspace's behalf, or `null` while it is unavailable. */
export function cloudAIClient(workspaceId: string): CloudAIClient | null {
  const home = homeAI.value
  if (!home || !workspaceId) return null
  const key = `${cloudAIIdentity.value}:${workspaceId}`
  let tokens = tokenSources.get(key)
  if (!tokens) {
    const api = cloudAPIClient(home.server, home.discovery)
    tokens = createCloudAITokens(() => api.requestAIToken(workspaceId))
    tokenSources.set(key, tokens)
  }
  return createCloudAIClient({ endpoint: home.endpoint, tokens, fetch: cloudFetch })
}

/** The Home server's workspaces whose plan includes AI, in the order the server lists them. */
export async function cloudAIWorkspaces(): Promise<CloudAIWorkspace[]> {
  const home = homeAI.value
  if (!home) return []
  const api = cloudAPIClient(home.server, home.discovery)
  const entitled = await Promise.all(
    home.connection.workspaces.map(async (workspace) => {
      const entitlements = await api.getWorkspaceEntitlements(workspace.id).catch(() => null)
      return entitlements?.features.cloudAI ? { id: workspace.id, name: workspace.name } : null
    })
  )
  return compact(entitled)
}
