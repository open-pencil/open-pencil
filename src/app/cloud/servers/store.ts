import { StorageSerializers, useLocalStorage } from '@vueuse/core'
import * as v from 'valibot'
import { computed, ref } from 'vue'

import { IS_BROWSER } from '@open-pencil/core/constants'

import { OFFICIAL_CLOUD_URL } from '@/constants'

import { normalizeCloudServerURL } from './address'

const CLOUD_SERVERS_KEY = 'open-pencil:cloud-servers'

const cloudAccountSchema = v.object({
  id: v.string(),
  name: v.string(),
  email: v.string()
})

const cloudServerSchema = v.object({
  /** Lowercase hex from the address, so it can name credentials and storage profiles. */
  id: v.pipe(v.string(), v.regex(/^[0-9a-f]{32}$/)),
  url: v.pipe(v.string(), v.url()),
  kind: v.picklist(['official', 'self-hosted']),
  /** The last account signed in here, kept after sign-in expires to sign back in to it. */
  account: v.nullable(cloudAccountSchema),
  addedAt: v.string()
})

const cloudServersSchema = v.object({
  servers: v.array(cloudServerSchema),
  home: v.nullable(v.string())
})

export type CloudAccount = v.InferOutput<typeof cloudAccountSchema>
export type CloudServer = v.InferOutput<typeof cloudServerSchema>
type CloudServers = v.InferOutput<typeof cloudServersSchema>

const EMPTY: CloudServers = { servers: [], home: null }

const stored = !IS_BROWSER
  ? ref<unknown>(null)
  : useLocalStorage<unknown>(CLOUD_SERVERS_KEY, null, {
      serializer: StorageSerializers.object,
      writeDefaults: false
    })

const state = computed<CloudServers>(() => {
  const parsed = v.safeParse(cloudServersSchema, stored.value)
  return parsed.success ? parsed.output : EMPTY
})

function write(next: CloudServers): void {
  stored.value = next
}

/** Servers this app has connected to, in the order they were added. */
export const cloudServers = computed(() => state.value.servers)

/** The server whose workspaces Home shows, if any. */
export const homeCloudServer = computed(
  () => state.value.servers.find((server) => server.id === state.value.home) ?? null
)

export function findCloudServer(id: string): CloudServer | null {
  return state.value.servers.find((server) => server.id === id) ?? null
}

/** The same address always gets the same id, on every device. */
export async function cloudServerId(url: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url))
  return Array.from(new Uint8Array(digest, 0, 16), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

/**
 * Remembers a server, or returns it when already added. The first server goes on Home. Throws
 * when the address cannot be a server's.
 */
export async function addCloudServer(input: {
  kind: CloudServer['kind']
  url?: string
}): Promise<CloudServer> {
  const url = normalizeCloudServerURL(
    input.kind === 'official' ? OFFICIAL_CLOUD_URL : (input.url ?? '')
  )
  if (!url) throw new TypeError('Cloud server address is invalid')
  const existing = state.value.servers.find((server) => server.url === url)
  if (existing) return existing
  const server: CloudServer = {
    id: await cloudServerId(url),
    url,
    kind: input.kind,
    account: null,
    addedAt: new Date().toISOString()
  }
  const current = state.value
  write({ servers: [...current.servers, server], home: current.home ?? server.id })
  return server
}

/** Forgets a server; Home moves to the next one. */
export function removeCloudServer(id: string): void {
  const current = state.value
  const servers = current.servers.filter((server) => server.id !== id)
  const home = current.home === id ? (servers[0]?.id ?? null) : current.home
  write({ servers, home })
}

export function showCloudServerOnHome(id: string): void {
  if (!findCloudServer(id)) return
  write({ ...state.value, home: id })
}

export function rememberCloudAccount(id: string, account: CloudAccount | null): void {
  const current = state.value
  write({
    ...current,
    servers: current.servers.map((server) => (server.id === id ? { ...server, account } : server))
  })
}
