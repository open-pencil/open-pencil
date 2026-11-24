import { computed, shallowRef } from 'vue'

import {
  agentPairingId,
  agentPairingURL,
  CLOUD_AGENT_PAIRING_TOKEN_PREFIX,
  cloudMCPResource,
  COLLAB_ACTIONS
} from '@open-pencil/cloud/contract'
import { randomHex } from '@open-pencil/std/random'
import { HOUR_MS } from '@open-pencil/std/timing'

import { runAgentTool, serveRoomAgentTools } from '@/app/cloud/rooms/agent-tools'
import { findCloudServer, homeCloudServer, isCloudSiteServer } from '@/app/cloud/servers/store'
import { cloudConnections } from '@/app/cloud/sessions/connection'
import { createCloudRelayJoin, type CloudRelayOptions } from '@/app/collab/transport/cloud'
import { getActiveEditorStore } from '@/app/editor/active-store'

/**
 * How long a pairing's ticket lasts on the transport before it presents the token again; the
 * pairing itself lasts until the tab disconnects.
 */
const TICKET_LIFETIME_MS = 12 * HOUR_MS

/** What a paired agent was last seen doing, for the panel to say. */
export type AgentPairingState =
  | { status: 'off' }
  | { status: 'connecting' }
  | { status: 'paired'; mcpURL: string; token: string; lastCallAt: number | null }
  | { status: 'failed' }

export const agentPairing = shallowRef<AgentPairingState>({ status: 'off' })

/**
 * The server a tab pairs through: the one serving this editor, or else the one on Home, when it
 * says it pairs tabs with agents.
 */
export const agentPairingServer = computed(() => {
  const servers = Object.keys(cloudConnections.value)
  const site = servers.find((id) => isCloudSiteServer(id))
  const server = (site ? findCloudServer(site) : null) ?? homeCloudServer.value
  if (!server) return null
  return cloudConnections.value[server.id]?.discovery?.capabilities.agents ? server : null
})

let stop: (() => void) | null = null

/**
 * Pairs this window with a coding agent: makes a pairing token, connects to the server's pairing
 * hub with it, and runs the agent's calls on the document in the active tab, as the local MCP
 * server's calls run, until disconnected. The token goes to the agent; the server keeps neither it
 * nor anything the window sends.
 */
export async function startAgentPairing(
  createSocket?: CloudRelayOptions['createSocket']
): Promise<void> {
  const server = agentPairingServer.value
  if (!server) return
  stopAgentPairing()
  agentPairing.value = { status: 'connecting' }
  const token = `${CLOUD_AGENT_PAIRING_TOKEN_PREFIX}${randomHex(32)}`
  const pairingId = await agentPairingId(token)
  const transport = createCloudRelayJoin({
    url: agentPairingURL(server.url, pairingId),
    ticket: async () => ({
      token,
      expiresAt: new Date(Date.now() + TICKET_LIFETIME_MS).toISOString()
    }),
    onRefused: () => {
      stopAgentPairing()
      agentPairing.value = { status: 'failed' }
    },
    heartbeat: true,
    createSocket
  })('agent-pairing')
  const paired = { mcpURL: cloudMCPResource(server.url), token }
  let joined: ((peerId: string) => void) | null = null
  transport.onPeerJoin((peerId) => {
    agentPairing.value = { status: 'paired', ...paired, lastCallAt: null }
    joined?.(peerId)
  })
  const tools = serveRoomAgentTools(transport.makeAction(COLLAB_ACTIONS.agentTools), {
    store: getActiveEditorStore,
    onPeerJoin(handler) {
      joined = handler
      return () => {
        joined = null
      }
    },
    run: (store, call, signal) => {
      agentPairing.value = { status: 'paired', ...paired, lastCallAt: Date.now() }
      return runAgentTool(store, call, signal)
    }
  })
  stop = () => {
    tools.stop()
    void transport.leave()
  }
}

/** Ends the pairing: the agent's connection stops working at once. */
export function stopAgentPairing(): void {
  stop?.()
  stop = null
  agentPairing.value = { status: 'off' }
}
