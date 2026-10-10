import { shallowRef } from 'vue'

import {
  CloudClientError,
  createCloudAPIClient,
  createCloudPortalClient,
  CloudPortalAPIError,
  discoverCloud,
  type CloudAPIClient,
  type CloudDiscoveryFailure,
  type CloudFetch
} from '@open-pencil/cloud/client'
import type { CloudDiscovery, WorkspaceSummary } from '@open-pencil/cloud/contract'

import { tauriFetch } from '@/app/tauri/http'
import { IS_TAURI } from '@/constants'

import { rememberCloudAccount, type CloudAccount, type CloudServer } from '../servers/store'
import { clearCloudSessionToken, readCloudSessionToken } from './token'

/**
 * Where this app stands with a server: signed in, waiting for an administrator, refused, signed
 * out after having been signed in, never signed in, or out of reach.
 */
export type CloudSessionState =
  | 'checking'
  | 'signed-in'
  | 'pending'
  | 'closed'
  | 'expired'
  | 'signed-out'
  | 'unreachable'

export type CloudConnection = {
  state: CloudSessionState
  discovery: CloudDiscovery | null
  account: CloudAccount | null
  workspaces: WorkspaceSummary[]
  /** Why the server could not be used, while `unreachable`. */
  failure: CloudDiscoveryFailure | null
}

const INITIAL: CloudConnection = {
  state: 'checking',
  discovery: null,
  account: null,
  workspaces: [],
  failure: null
}

/** Each server's connection, replaced whole on every change. */
export const cloudConnections = shallowRef<Readonly<Record<string, CloudConnection>>>({})
const discoveries = new Map<string, Promise<CloudDiscovery>>()
const generations = new Map<string, number>()

export function cloudConnection(serverId: string): CloudConnection {
  return cloudConnections.value[serverId] ?? INITIAL
}

function publish(serverId: string, connection: CloudConnection): void {
  cloudConnections.value = { ...cloudConnections.value, [serverId]: connection }
}

/** Desktop requests skip the webview's CORS, since a server lists only its web editors. */
export const cloudFetch: CloudFetch = (input, init) =>
  IS_TAURI ? tauriFetch(input, init) : globalThis.fetch(input, init)

/** Requests to one server, carrying its device-code token when this app has one. */
export function cloudServerFetch(serverId: string): CloudFetch {
  return async (input, init) => {
    const token = await readCloudSessionToken(serverId)
    if (!token) return cloudFetch(input, init)
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${token}`)
    return cloudFetch(input, { ...init, headers })
  }
}

/** The server's discovery, fetched once per address while the app runs. */
export function discoverCloudServer(url: string): Promise<CloudDiscovery> {
  const cached = discoveries.get(url)
  if (cached) return cached
  const request = discoverCloud(url, { fetch: cloudFetch })
  discoveries.set(url, request)
  request.catch(() => discoveries.delete(url))
  return request
}

export function cloudAPIClient(server: CloudServer, discovery: CloudDiscovery): CloudAPIClient {
  return createCloudAPIClient(discovery.apiURL, { fetch: cloudServerFetch(server.id) })
}

async function signedInConnection(
  server: CloudServer,
  discovery: CloudDiscovery
): Promise<CloudConnection> {
  const portal = createCloudPortalClient({
    baseURL: new URL(discovery.apiURL).origin,
    fetch: cloudServerFetch(server.id)
  })
  let status: Awaited<ReturnType<typeof portal.accountStatus>>
  try {
    status = await portal.accountStatus()
  } catch (error) {
    if (!(error instanceof CloudPortalAPIError) || error.kind !== 'authentication-required') {
      throw error
    }
    // A token the server no longer accepts cannot be used again; keep the account to sign back in.
    if (await readCloudSessionToken(server.id)) await clearCloudSessionToken(server.id)
    return {
      ...INITIAL,
      state: server.account ? 'expired' : 'signed-out',
      discovery,
      account: server.account
    }
  }
  const account = { id: status.user.userId, name: status.user.name, email: status.user.email }
  rememberCloudAccount(server.id, account)
  if (status.state !== 'active') {
    const state = status.state === 'pending' ? 'pending' : 'closed'
    return { ...INITIAL, state, discovery, account }
  }
  const { workspaces } = await cloudAPIClient(server, discovery).listWorkspaces()
  return { state: 'signed-in', discovery, account, workspaces, failure: null }
}

/** Asks the server where this app stands and publishes the answer. */
export async function refreshCloudConnection(server: CloudServer): Promise<CloudConnection> {
  const generation = (generations.get(server.id) ?? 0) + 1
  generations.set(server.id, generation)
  const previous = cloudConnection(server.id)
  publish(server.id, { ...previous, state: 'checking', failure: null })
  let next: CloudConnection
  try {
    const discovery = await discoverCloudServer(server.url)
    next = await signedInConnection(server, discovery)
  } catch (error) {
    next = {
      ...previous,
      state: 'unreachable',
      account: previous.account ?? server.account,
      failure: error instanceof CloudClientError ? error.reason : 'unreachable'
    }
  }
  if (generations.get(server.id) === generation) publish(server.id, next)
  return next
}

/** Drops what the app knows about a server's session, after signing out or removing it. */
export function forgetCloudConnection(serverId: string): void {
  generations.set(serverId, (generations.get(serverId) ?? 0) + 1)
  const { [serverId]: _removed, ...rest } = cloudConnections.value
  cloudConnections.value = rest
}
