import {
  CloudAPIError,
  createCloudAPIClient,
  discoverCloud,
  type CloudAPIClient,
  type CloudFetch
} from '@open-pencil/cloud/client'
import type { CloudDiscovery, CloudSession, WorkspaceSummary } from '@open-pencil/cloud/contract'

export type CloudConnectionStatus =
  | 'disconnected'
  | 'discovering'
  | 'unauthenticated'
  | 'connected'
  | 'offline'
  | 'error'

export type CloudConnectionSnapshot = {
  id: string
  serverURL: string
  status: CloudConnectionStatus
  discovery: CloudDiscovery | null
  session: CloudSession | null
  workspaces: WorkspaceSummary[]
  selectedWorkspaceId: string | null
  lastConnectedAt: string | null
  error: string | null
}

export type CloudConnection = CloudConnectionSnapshot & {
  client: CloudAPIClient | null
}

export type CloudConnectionServiceOptions = {
  fetch: CloudFetch
  readSelectedWorkspace(serverURL: string): string | null
  writeSelectedWorkspace(serverURL: string, workspaceId: string | null): void
}

export type CloudConnectionService = ReturnType<typeof createCloudConnectionService>

export function normalizeCloudServerURL(input: string): string {
  const url = new URL(input.trim())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('OpenPencil Cloud server URL must use HTTP or HTTPS')
  }
  url.pathname = url.pathname.replace(/\/+$/, '') || '/'
  url.search = ''
  url.hash = ''
  return url.href.replace(/\/$/, '')
}

export function createCloudConnectionService(options: CloudConnectionServiceOptions) {
  const connections = new Map<string, CloudConnection>()
  const pending = new Map<string, Promise<CloudConnection>>()
  const listeners = new Set<(connection: CloudConnectionSnapshot) => void>()

  function snapshot(connection: CloudConnection): CloudConnectionSnapshot {
    const { client: _client, ...value } = connection
    return value
  }

  function publish(connection: CloudConnection): void {
    const value = snapshot(connection)
    for (const listener of listeners) listener(value)
  }

  function initial(serverURL: string): CloudConnection {
    return {
      id: serverURL,
      serverURL,
      status: 'disconnected',
      discovery: null,
      session: null,
      workspaces: [],
      selectedWorkspaceId: options.readSelectedWorkspace(serverURL),
      lastConnectedAt: null,
      error: null,
      client: null
    }
  }

  async function refresh(serverURL: string): Promise<CloudConnection> {
    const normalized = normalizeCloudServerURL(serverURL)
    const existing = connections.get(normalized) ?? initial(normalized)
    existing.status = 'discovering'
    existing.error = null
    connections.set(normalized, existing)
    publish(existing)
    try {
      const discovery =
        existing.discovery ?? (await discoverCloud(normalized, { fetch: options.fetch }))
      const client = createCloudAPIClient(discovery.apiURL, { fetch: options.fetch })
      const session = await client.getSession()
      const workspaces = session ? (await client.listWorkspaces()).workspaces : []
      const selectedWorkspaceId = selectWorkspace(existing.selectedWorkspaceId, workspaces)
      const connection: CloudConnection = {
        ...existing,
        discovery,
        client,
        session,
        workspaces,
        selectedWorkspaceId,
        status: session ? 'connected' : 'unauthenticated',
        lastConnectedAt: new Date().toISOString(),
        error: null
      }
      connections.set(normalized, connection)
      options.writeSelectedWorkspace(normalized, selectedWorkspaceId)
      publish(connection)
      return connection
    } catch (error) {
      existing.status = connectionFailureStatus(error)
      existing.error = error instanceof Error ? error.message : String(error)
      publish(existing)
      throw error
    }
  }

  function connect(serverURL: string, force = false): Promise<CloudConnection> {
    const normalized = normalizeCloudServerURL(serverURL)
    const cached = connections.get(normalized)
    if (!force && cached?.client && cached.discovery) return Promise.resolve(cached)
    const active = pending.get(normalized)
    if (active && !force) return active
    if (force) {
      const existing = connections.get(normalized)
      if (existing) existing.discovery = null
    }
    const request = refresh(normalized).finally(() => {
      if (pending.get(normalized) === request) pending.delete(normalized)
    })
    pending.set(normalized, request)
    return request
  }

  return {
    connect,
    async refresh(serverURL: string) {
      return connect(serverURL, true)
    },
    get(serverURL: string): CloudConnection | null {
      return connections.get(normalizeCloudServerURL(serverURL)) ?? null
    },
    disconnect(serverURL: string): void {
      const normalized = normalizeCloudServerURL(serverURL)
      pending.delete(normalized)
      connections.delete(normalized)
    },
    selectWorkspace(serverURL: string, workspaceId: string | null): void {
      const normalized = normalizeCloudServerURL(serverURL)
      const connection = connections.get(normalized)
      if (!connection) return
      const selected = connection.workspaces.some((workspace) => workspace.id === workspaceId)
        ? workspaceId
        : null
      connection.selectedWorkspaceId = selected
      options.writeSelectedWorkspace(normalized, selected)
      publish(connection)
    },
    subscribe(listener: (connection: CloudConnectionSnapshot) => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

function selectWorkspace(current: string | null, workspaces: WorkspaceSummary[]): string | null {
  if (current && workspaces.some((workspace) => workspace.id === current)) return current
  return workspaces[0]?.id ?? null
}

function connectionFailureStatus(error: unknown): 'error' | 'offline' | 'unauthenticated' {
  if (error instanceof CloudAPIError && error.status === 401) return 'unauthenticated'
  if (error instanceof TypeError) return 'offline'
  return 'error'
}
