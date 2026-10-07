import { isEqual } from 'es-toolkit'
import * as v from 'valibot'
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

export const MCP_CONNECTION_NAME_MAX_LENGTH = 80
const MAX_URL_LENGTH = 2048
const MCP_CONNECTION_ID_PATTERN = /^mcp-[a-z0-9._-]{1,60}$/

const bearerSchema = v.object({
  type: v.literal('bearer'),
  credentialRef: v.object({ integrationId: v.string(), profileId: v.string(), field: v.string() })
})

/** A stored bearer token counts only when it points at this connection's own credential. */
function parseAuthentication(value: unknown, id: MCPConnectionID): MCPAuthentication {
  const bearer = v.safeParse(bearerSchema, value)
  const expected = mcpConnectionCredentialRef(id)
  return bearer.success && isEqual(bearer.output.credentialRef, expected)
    ? { type: 'bearer', credentialRef: expected }
    : { type: 'none' }
}

const connectionSchema = v.object({
  id: v.pipe(v.string(), v.regex(MCP_CONNECTION_ID_PATTERN)),
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1),
    v.transform((name) => name.slice(0, MCP_CONNECTION_NAME_MAX_LENGTH))
  ),
  enabled: v.fallback(v.boolean(), false),
  transport: v.object({
    type: v.literal('streamable-http'),
    url: v.pipe(
      v.string(),
      v.trim(),
      v.check((url) => isValidMCPConnectionURL(url))
    )
  }),
  authentication: v.optional(v.unknown())
})

function parseConnection(value: unknown): MCPConnection | null {
  const parsed = v.safeParse(connectionSchema, value)
  if (!parsed.success) return null
  const { authentication, ...connection } = parsed.output
  const id = connection.id as MCPConnectionID
  return { ...connection, id, authentication: parseAuthentication(authentication, id) }
}

const settingsSchema = v.object({ version: v.literal(1), connections: v.array(v.unknown()) })

export function parseMCPConnectionSettings(value: unknown): MCPConnectionSettings {
  const settings = v.safeParse(settingsSchema, value)
  if (!settings.success) return { version: 1, connections: [] }
  const connections: MCPConnection[] = []
  const ids = new Set<string>()
  const names = new Set<string>()
  for (const candidate of settings.output.connections) {
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

function isValidMCPConnectionURL(url: string): boolean {
  try {
    validateMCPConnectionURL(url)
    return true
  } catch {
    return false
  }
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
  if (name.length > MCP_CONNECTION_NAME_MAX_LENGTH) throw new Error('Connection name is too long')
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
