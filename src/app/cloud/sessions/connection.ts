import { isEqual } from 'es-toolkit'
import { shallowRef } from 'vue'

import {
  CloudClientError,
  createCloudAPIClient,
  createCloudPortalClient,
  CloudPortalAPIError,
  discoverCloud,
  type CloudAPIClient,
  type CloudDiscoveryFailure,
  type CloudFetch,
  type CloudPortalClient
} from '@open-pencil/cloud/client'
import {
  CLOUD_EDITOR_VERSION_HEADER,
  type CloudDiscovery,
  type WorkspaceSummary
} from '@open-pencil/cloud/contract'

import { APP_VERSION } from '@/app/runtime/version'
import { tauriFetch } from '@/app/tauri/http'
import { IS_TAURI } from '@/constants'

import {
  findCloudServer,
  rememberCloudAccount,
  type CloudAccount,
  type CloudServer
} from '../servers/store'
import { tellCloudLocale } from './locale'
import { clearCloudSessionToken, readCloudSessionToken } from './token'

/**
 * Where this app stands with a server: signed in, waiting for an administrator, refused, asked to
 * prove its second step in the browser, asked to accept the server's current terms, signed out after having been signed in, never signed in, or
 * out of reach.
 */
export type CloudSessionState =
  | 'checking'
  | 'signed-in'
  | 'pending'
  | 'closed'
  | 'two-step'
  | 'terms'
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
/** Each server's latest check while it runs. */
const checks = new Map<string, Promise<CloudConnection>>()

export function cloudConnection(serverId: string): CloudConnection {
  return cloudConnections.value[serverId] ?? INITIAL
}

function publish(serverId: string, connection: CloudConnection): void {
  cloudConnections.value = { ...cloudConnections.value, [serverId]: connection }
}

/**
 * Desktop requests skip the webview's CORS, since a server lists only its web editors, and name the
 * editor's version so a server can refuse one older than it supports.
 */
export const cloudFetch: CloudFetch = (input, init) => {
  if (!IS_TAURI) return globalThis.fetch(input, init)
  // A request's own headers, then the call's, as `fetch` would combine them.
  const headers = new Headers(input instanceof Request ? input.headers : undefined)
  new Headers(init?.headers).forEach((value, name) => headers.set(name, value))
  headers.set(CLOUD_EDITOR_VERSION_HEADER, APP_VERSION)
  return tauriFetch(input, { ...init, headers })
}

/**
 * A server that refused this editor as too old raised its minimum since the app last asked: the
 * kept discovery is stale, so the server is asked again and its answer says to update.
 */
/**
 * Servers being asked again after a refusal. A refusal during that check, as from a replica still
 * on the old minimum while discovery comes from one on the new, starts no other one.
 */
const rechecking = new Set<string>()

function recheckRefusedEditor(serverId: string): void {
  const server = findCloudServer(serverId)
  if (!server || rechecking.has(serverId)) return
  rechecking.add(serverId)
  discoveries.delete(server.url)
  void refreshCloudConnection(server).finally(() => rechecking.delete(serverId))
}

/** Requests to one server, carrying its device-code token when this app has one. */
export function cloudServerFetch(serverId: string): CloudFetch {
  return async (input, init) => {
    const token = await readCloudSessionToken(serverId)
    let request = init
    if (token) {
      const headers = new Headers(init?.headers)
      headers.set('Authorization', `Bearer ${token}`)
      request = { ...init, headers }
    }
    const response = await cloudFetch(input, request)
    if (response.status === 426) recheckRefusedEditor(serverId)
    return response
  }
}

/** The server's discovery, fetched once per address while the app runs. */
export function discoverCloudServer(url: string): Promise<CloudDiscovery> {
  const cached = discoveries.get(url)
  if (cached) return cached
  const request = discoverCloud(url, { fetch: cloudFetch, editorVersion: APP_VERSION })
  discoveries.set(url, request)
  request.catch(() => discoveries.delete(url))
  return request
}

export function cloudAPIClient(server: CloudServer, discovery: CloudDiscovery): CloudAPIClient {
  return createCloudAPIClient(discovery.apiURL, { fetch: cloudServerFetch(server.id) })
}

/** The server's account pages' API, as this app's session there. */
export function cloudPortalClient(
  server: CloudServer,
  discovery: CloudDiscovery
): CloudPortalClient {
  return createCloudPortalClient({
    baseURL: new URL(discovery.apiURL).origin,
    fetch: cloudServerFetch(server.id)
  })
}

/** Forgets a token the server turned away, unless a newer sign-in replaced it meanwhile. */
async function clearCloudSessionTokenIfStill(serverId: string, token: string | null) {
  if (token && (await readCloudSessionToken(serverId)) === token) {
    await clearCloudSessionToken(serverId)
  }
}

/**
 * Where this app stands with a server. The account it answers with is remembered only while
 * `current` says no newer check started, so a check that finishes late cannot put back an account
 * another signed in over.
 */
async function signedInConnection(
  server: CloudServer,
  discovery: CloudDiscovery,
  current: () => boolean
): Promise<CloudConnection> {
  const portal = cloudPortalClient(server, discovery)
  // The token the answer is about: a newer sign-in may store another while the check runs.
  const token = await readCloudSessionToken(server.id)
  let status: Awaited<ReturnType<typeof portal.accountStatus>>
  try {
    status = await portal.accountStatus()
  } catch (error) {
    if (!(error instanceof CloudPortalAPIError) || error.kind !== 'authentication-required') {
      throw error
    }
    // A token the server no longer accepts cannot be used again; keep the account to sign back in.
    await clearCloudSessionTokenIfStill(server.id, token)
    return {
      ...INITIAL,
      state: server.account ? 'expired' : 'signed-out',
      discovery,
      account: server.account
    }
  }
  const account = {
    id: status.user.userId,
    name: status.user.name,
    email: status.user.email,
    image: status.user.image ?? null
  }
  if (current()) rememberCloudAccount(server.id, account)
  if (status.state === 'two-step' && token) {
    // A desktop app's own session counts as proved once a browser that proved it approved the
    // sign-in; one from before that never will, so the app signs in again.
    await clearCloudSessionTokenIfStill(server.id, token)
    return { ...INITIAL, state: 'expired', discovery, account }
  }
  if (status.state !== 'active') {
    const state =
      status.state === 'pending' || status.state === 'terms' || status.state === 'two-step'
        ? status.state
        : 'closed'
    return { ...INITIAL, state, discovery, account }
  }
  const { workspaces } = await cloudAPIClient(server, discovery).listWorkspaces()
  return { state: 'signed-in', discovery, account, workspaces, failure: null }
}

/** States in which a server has an account to write to, waiting for approval or terms too. */
const WRITTEN_TO = new Set<CloudSessionState>(['signed-in', 'pending', 'terms'])

/** Tells a server the app's language for the account signed in there, if one is. */
export function tellCloudConnectionLocale(server: CloudServer): void {
  const { state, discovery, account } = cloudConnection(server.id)
  if (discovery && account && WRITTEN_TO.has(state)) {
    void tellCloudLocale(
      { server: server.id, account: account.id },
      cloudPortalClient(server, discovery)
    )
  }
}

export type CloudConnectionRefresh = {
  /**
   * Keeps the last answer shown while the server is asked, and keeps it if the server cannot be
   * reached, as a list kept current in the background does. A check already under way answers
   * instead of a new one.
   */
  background?: boolean
}

/** Asks the server where this app stands and publishes the answer. */
export function refreshCloudConnection(
  server: CloudServer,
  options: CloudConnectionRefresh = {}
): Promise<CloudConnection> {
  if (options.background) {
    const running = checks.get(server.id)
    if (running) return running
  }
  const generation = (generations.get(server.id) ?? 0) + 1
  generations.set(server.id, generation)
  const check = askServer(server, generation, options.background ?? false)
  checks.set(server.id, check)
  void check.finally(() => {
    if (checks.get(server.id) === check) checks.delete(server.id)
  })
  return check
}

/**
 * Where this app stands with a server once the check under way, if any, finishes. Something that
 * only needs the answer waits for that check rather than starting another, which would throw the
 * first one's answer away and leave whoever waits on it reading `checking`.
 */
export function checkedCloudConnection(server: CloudServer): Promise<CloudConnection> {
  const running = checks.get(server.id)
  if (running) return running
  const connection = cloudConnection(server.id)
  return connection.state === 'checking'
    ? refreshCloudConnection(server)
    : Promise.resolve(connection)
}

/**
 * Where this app stands with a server now: signed in as last checked, or else the answer of the
 * check under way or of a new one, since a server out of reach or a session that ended may have
 * come back since the last answer.
 */
export function recheckedCloudConnection(server: CloudServer): Promise<CloudConnection> {
  const connection = cloudConnection(server.id)
  if (connection.state === 'signed-in') return Promise.resolve(connection)
  return checks.get(server.id) ?? refreshCloudConnection(server)
}

async function askServer(
  server: CloudServer,
  generation: number,
  background: boolean
): Promise<CloudConnection> {
  const previous = cloudConnection(server.id)
  if (!background) publish(server.id, { ...previous, state: 'checking', failure: null })
  let next: CloudConnection
  try {
    const discovery = await discoverCloudServer(server.url)
    next = await signedInConnection(
      server,
      discovery,
      () => generations.get(server.id) === generation
    )
  } catch (error) {
    if (background) return previous
    next = {
      ...previous,
      state: 'unreachable',
      account: previous.account ?? server.account,
      failure: error instanceof CloudClientError ? error.reason : 'unreachable'
    }
  }
  // A background check that found nothing new leaves the connection as it is, so nothing that
  // shows it re-renders.
  if (generations.get(server.id) === generation && !(background && isEqual(previous, next))) {
    publish(server.id, next)
    // Once the answer is out, so a language picked while the check ran is the one it reports.
    tellCloudConnectionLocale(server)
  }
  return next
}

/** Drops what the app knows about a server's session, after signing out or removing it. */
export function forgetCloudConnection(serverId: string): void {
  generations.set(serverId, (generations.get(serverId) ?? 0) + 1)
  checks.delete(serverId)
  const { [serverId]: _removed, ...rest } = cloudConnections.value
  cloudConnections.value = rest
}
