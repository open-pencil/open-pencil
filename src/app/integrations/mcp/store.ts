import { computed, ref, toRaw, watch } from 'vue'

import { appCredentialServices } from '@/app/settings/credentials/app'
import { credentialRef } from '@/app/settings/credentials/reference'
import type { CredentialRef, CredentialStatus } from '@/app/settings/credentials/types'

import { readMCPConnectionSettingsStorage, writeMCPConnectionSettingsStorage } from './storage'
import type {
  MCPAuthentication,
  MCPConnection,
  MCPConnectionDraft,
  MCPConnectionID,
  MCPConnectionSettings
} from './types'

const MAX_NAME_LENGTH = 80
const MAX_URL_LENGTH = 2048
const MCP_CONNECTION_ID_PATTERN = /^mcp-[a-z0-9._-]{1,60}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCredentialRef(value: unknown): value is CredentialRef {
  return (
    isRecord(value) &&
    typeof value.integrationId === 'string' &&
    typeof value.profileId === 'string' &&
    typeof value.field === 'string'
  )
}

function parseAuthentication(value: unknown, id: MCPConnectionID): MCPAuthentication {
  if (!isRecord(value) || value.type !== 'bearer') return { type: 'none' }
  const expectedReference = mcpConnectionCredentialRef(id)
  if (!isCredentialRef(value.credentialRef)) return { type: 'none' }
  const matchesExpected =
    value.credentialRef.integrationId === expectedReference.integrationId &&
    value.credentialRef.profileId === expectedReference.profileId &&
    value.credentialRef.field === expectedReference.field
  return matchesExpected ? { type: 'bearer', credentialRef: expectedReference } : { type: 'none' }
}

function parseConnection(value: unknown): MCPConnection | null {
  if (!isRecord(value) || !isRecord(value.transport)) return null
  const id = typeof value.id === 'string' ? value.id : ''
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  const url = typeof value.transport.url === 'string' ? value.transport.url.trim() : ''
  if (!MCP_CONNECTION_ID_PATTERN.test(id) || !name || value.transport.type !== 'streamable-http') {
    return null
  }
  try {
    validateMCPConnectionURL(url)
  } catch {
    return null
  }
  const connectionId = id as MCPConnectionID
  return {
    id: connectionId,
    name: name.slice(0, MAX_NAME_LENGTH),
    enabled: value.enabled === true,
    transport: { type: 'streamable-http', url },
    authentication: parseAuthentication(value.authentication, connectionId)
  }
}

export function parseMCPConnectionSettings(value: unknown): MCPConnectionSettings {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.connections)) {
    return { version: 1, connections: [] }
  }
  const connections: MCPConnection[] = []
  const ids = new Set<string>()
  const names = new Set<string>()
  for (const candidate of value.connections) {
    const connection = parseConnection(candidate)
    if (!connection || ids.has(connection.id)) continue
    const normalizedName = connection.name.toLowerCase()
    if (normalizedName === 'open-pencil' || names.has(normalizedName)) continue
    ids.add(connection.id)
    names.add(normalizedName)
    connections.push(connection)
  }
  return { version: 1, connections }
}

export function validateMCPConnectionURL(value: string): URL {
  if (!value || value.length > MAX_URL_LENGTH) throw new Error('Enter a valid MCP server URL')
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Enter a valid MCP server URL')
  }
  if (url.username || url.password) throw new Error('MCP server URLs cannot contain credentials')
  const loopback =
    url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('MCP servers must use HTTPS, except on loopback addresses')
  }
  return url
}

export const mcpConnectionSettings = ref<MCPConnectionSettings>(
  parseMCPConnectionSettings(readMCPConnectionSettingsStorage())
)

watch(mcpConnectionSettings, (settings) => writeMCPConnectionSettingsStorage(settings), {
  deep: true
})

export const enabledMCPConnections = computed(() =>
  mcpConnectionSettings.value.connections.filter((connection) => connection.enabled)
)

export function mcpConnectionCredentialRef(id: MCPConnectionID): CredentialRef {
  return credentialRef('mcp', 'bearer-token', id)
}

export function createMCPConnectionDraft(connection?: MCPConnection): MCPConnectionDraft {
  return {
    id: connection?.id ?? null,
    name: connection?.name ?? '',
    url: connection?.transport.url ?? '',
    enabled: connection?.enabled ?? false,
    authenticationType: connection?.authentication.type ?? 'none'
  }
}

export function saveMCPConnectionDraft(draft: MCPConnectionDraft): MCPConnection {
  const name = draft.name.trim()
  if (!name) throw new Error('Connection name is required')
  if (name.length > MAX_NAME_LENGTH) throw new Error('Connection name is too long')
  if (name.toLowerCase() === 'open-pencil') throw new Error('The open-pencil name is reserved')
  const duplicateName = mcpConnectionSettings.value.connections.some(
    (connection) =>
      connection.id !== draft.id && connection.name.toLowerCase() === name.toLowerCase()
  )
  if (duplicateName) throw new Error('Connection names must be unique')
  const url = validateMCPConnectionURL(draft.url.trim()).toString()
  if (draft.id && !MCP_CONNECTION_ID_PATTERN.test(draft.id)) {
    throw new Error('Connection ID is invalid')
  }
  const id = draft.id ?? (`mcp-${crypto.randomUUID()}` as MCPConnectionID)
  const authentication: MCPAuthentication =
    draft.authenticationType === 'bearer'
      ? { type: 'bearer', credentialRef: mcpConnectionCredentialRef(id) }
      : { type: 'none' }
  const connection: MCPConnection = {
    id,
    name,
    enabled: draft.enabled,
    transport: { type: 'streamable-http', url },
    authentication
  }
  const index = mcpConnectionSettings.value.connections.findIndex((item) => item.id === id)
  if (index === -1) mcpConnectionSettings.value.connections.push(connection)
  else mcpConnectionSettings.value.connections[index] = connection
  return connection
}

export function setMCPConnectionCredential(id: MCPConnectionID, value: string): Promise<void> {
  const token = value.trim()
  const reference = mcpConnectionCredentialRef(id)
  return token
    ? appCredentialServices.manager.set(reference, token)
    : appCredentialServices.manager.clear(reference)
}

export function mcpConnectionCredentialStatus(id: MCPConnectionID): Promise<CredentialStatus> {
  return appCredentialServices.manager.status(mcpConnectionCredentialRef(id))
}

export async function removeMCPConnection(id: MCPConnectionID): Promise<void> {
  await appCredentialServices.manager.clear(mcpConnectionCredentialRef(id))
  mcpConnectionSettings.value.connections = mcpConnectionSettings.value.connections.filter(
    (connection) => connection.id !== id
  )
}

export function replaceMCPConnectionSettings(settings: MCPConnectionSettings): void {
  mcpConnectionSettings.value = structuredClone(settings)
}

export function mcpConnectionSettingsSnapshot(): MCPConnectionSettings {
  return structuredClone(toRaw(mcpConnectionSettings.value))
}
