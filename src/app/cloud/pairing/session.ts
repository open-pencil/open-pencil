import { computed, shallowRef, watch } from 'vue'

import {
  agentPairingId,
  agentPairingURL,
  cloudMCPResource,
  COLLAB_ACTIONS
} from '@open-pencil/cloud/contract'
import { HOUR_MS } from '@open-pencil/std/timing'

import { serveRoomAgentTools } from '@/app/cloud/rooms/agent-tools'
import {
  cloudServers,
  findCloudServer,
  homeCloudServer,
  isCloudSiteServer
} from '@/app/cloud/servers/store'
import { cloudConnections } from '@/app/cloud/sessions/connection'
import { createCloudRelayJoin, type CloudRelayOptions } from '@/app/collab/transport/cloud'
import { getActiveEditorStore } from '@/app/editor/active-store'
import { isTauri } from '@/app/tauri/env'

import { runPairedTool } from './run'
import { newPairingToken, storedPairing, type StoredPairing } from './stored'

/** How long the transport goes before it presents the token again; the pairing lasts past it. */
const TICKET_LIFETIME_MS = 12 * HOUR_MS
/** One window of the browser serves its pairing; another takes over once that one closes. */
const SERVING_LOCK = 'open-pencil:agent-pairing'

export type AgentPairingState =
  | { status: 'off' }
  | { status: 'connecting'; mcpURL: string; token: string }
  | { status: 'paired'; mcpURL: string; token: string; lastCallAt: number | null }
  | { status: 'failed' }

export const agentPairing = shallowRef<AgentPairingState>({ status: 'off' })

/**
 * The server a browser pairs through: the one serving this editor, or else the one on Home, when it
 * says it pairs editors with agents. A desktop app has the local MCP server instead.
 */
export const agentPairingServer = computed(() => {
  if (isTauri()) return null
  const site = cloudServers.value.find((server) => isCloudSiteServer(server.id))
  const server = (site && findCloudServer(site.id)) ?? homeCloudServer.value
  if (!server) return null
  const capabilities = cloudConnections.value[server.id]?.discovery?.capabilities
  return capabilities?.agents ? { url: server.url, signIn: capabilities.apps } : null
})

/** Serves a pairing from this window until `signal` aborts. */
async function serve(
  pairing: StoredPairing,
  signal: AbortSignal,
  createSocket?: CloudRelayOptions['createSocket']
): Promise<void> {
  const pairingId = await agentPairingId(pairing.token)
  if (signal.aborted) return
  const paired = { mcpURL: cloudMCPResource(pairing.server), token: pairing.token }
  let lastCallAt: number | null = null
  const ended = new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => resolve(), { once: true })
  })
  const transport = createCloudRelayJoin({
    url: agentPairingURL(pairing.server, pairingId),
    ticket: async () => ({
      token: pairing.token,
      expiresAt: new Date(Date.now() + TICKET_LIFETIME_MS).toISOString()
    }),
    onRefused: () => {
      storedPairing.value = null
      agentPairing.value = { status: 'failed' }
    },
    heartbeat: true,
    createSocket
  })('agent-pairing')
  let joined: ((peerId: string) => void) | null = null
  const tools = serveRoomAgentTools(transport.makeAction(COLLAB_ACTIONS.agentTools), {
    store: getActiveEditorStore,
    onPeerJoin(handler) {
      joined = handler
      return () => {
        joined = null
      }
    },
    run: (store, call, callSignal) => {
      lastCallAt = Date.now()
      agentPairing.value = { status: 'paired', ...paired, lastCallAt }
      return runPairedTool(store, call, callSignal)
    }
  })
  transport.onPeerJoin((peerId) => {
    agentPairing.value = { status: 'paired', ...paired, lastCallAt }
    joined?.(peerId)
  })
  await ended
  tools.stop()
  await transport.leave()
}

/**
 * Keeps this browser's pairing served while one is stored, from one of its windows at a time, and
 * ends it in every window once it is cleared.
 */
export function followAgentPairing(createSocket?: CloudRelayOptions['createSocket']): () => void {
  let serving: AbortController | null = null
  const stopWatching = watch(
    storedPairing,
    (pairing) => {
      serving?.abort()
      serving = null
      if (!pairing) {
        if (agentPairing.value.status !== 'failed') agentPairing.value = { status: 'off' }
        return
      }
      const controller = new AbortController()
      serving = controller
      agentPairing.value = {
        status: 'connecting',
        mcpURL: cloudMCPResource(pairing.server),
        token: pairing.token
      }
      void navigator.locks
        .request(SERVING_LOCK, { signal: controller.signal }, () =>
          serve(pairing, controller.signal, createSocket)
        )
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            console.warn('[Cloud] Serving the agent pairing failed', error)
            agentPairing.value = { status: 'failed' }
          }
        })
    },
    { immediate: true }
  )
  return () => {
    stopWatching()
    serving?.abort()
  }
}

/** Pairs this browser with whoever is given the fresh token. */
export function startAgentPairing(): void {
  const server = agentPairingServer.value
  if (!server) return
  agentPairing.value = { status: 'off' }
  storedPairing.value = { server: server.url, token: newPairingToken() }
}

/** Ends the pairing: the agent's connection stops working at once, in every window. */
export function stopAgentPairing(): void {
  agentPairing.value = { status: 'off' }
  storedPairing.value = null
}
