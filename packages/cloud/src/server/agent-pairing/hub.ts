import {
  agentPairingId,
  COLLAB_ACTIONS,
  createRelayClientAssembler,
  decodeRelayClientFrame,
  isAgentPairingToken,
  RELAY_CLOSE,
  RELAY_SERVER_PEER,
  type AgentToolCall,
  type AgentToolOutcome
} from '#cloud/contract'
import { createAgentToolCalls } from '#cloud/server/collaboration/relay/agent-tools'
import type { RelayConnection, RelaySocket } from '#cloud/server/collaboration/relay/connection'
import { send } from '#cloud/server/collaboration/relay/room'
import * as v from 'valibot'

import { DEADLINE_MS } from '@open-pencil/std/timing'

/** What a runtime keeps with a paired tab's socket, to resume it after setting the hub aside. */
const pairedStateSchema = v.object({
  pairing: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
  peerId: v.pipe(v.string(), v.uuid()),
  toolHost: v.boolean()
})
export type PairedTabState = v.InferOutput<typeof pairedStateSchema>

/** A paired tab's kept state, or null when what the runtime kept is not one. */
export function readPairedTabState(value: unknown): PairedTabState | null {
  const parsed = v.safeParse(pairedStateSchema, value)
  return parsed.success ? parsed.output : null
}

/** A socket of a paired tab, which may keep its state as a relay socket does. */
export type PairingSocket = Omit<RelaySocket, 'remember'> & {
  remember?(state: PairedTabState): void
}

type PairedTab = {
  id: string
  pairing: string
  socket: PairingSocket
  toolHost: boolean
}

export type AgentPairingHubOptions = {
  /**
   * The one pairing this hub serves, for a runtime that keeps a hub per pairing; a tab presenting
   * another token is turned away.
   */
  pairing?: string
  /** The most one socket message may carry; a tab's answers arrive as fragments up to `maximumAnswerBytes`. */
  maximumMessageBytes: number
  /** The most a tab's answer may carry once its fragments are joined, as an exported image. */
  maximumAnswerBytes: number
  /** How long a socket may stay open without presenting its token. */
  authTimeoutMs?: number
  /** How long a call may take before it is cancelled. */
  toolTimeoutMs?: number
}

/**
 * Carries a coding agent's design tool calls to the editor tab paired with it. A tab connects and
 * presents its pairing token, the relay's welcome names the hub as its one peer, the tab offers
 * to run tools, and each call goes to the tab of that pairing that offered last. Nothing is kept
 * beyond the open sockets: a pairing with no tab connected answers that nobody has it open.
 */
export function createAgentPairingHub(options: AgentPairingHubOptions) {
  const tabs = new Set<PairedTab>()
  const calls = createAgentToolCalls<PairedTab>({
    timeoutMs: options.toolTimeoutMs,
    mayHost: () => true,
    remember
  })
  const authTimeoutMs = options.authTimeoutMs ?? DEADLINE_MS.request

  function remember(tab: PairedTab) {
    tab.socket.remember?.({ pairing: tab.pairing, peerId: tab.id, toolHost: tab.toolHost })
  }

  function welcome(tab: PairedTab) {
    send(tab.socket, { type: 'welcome', peerId: tab.id, peers: [RELAY_SERVER_PEER] })
  }

  function open(socket: PairingSocket, resumed: PairedTab | null): RelayConnection {
    let tab = resumed
    let closed = false
    const assembler = createRelayClientAssembler(() =>
      tab ? options.maximumAnswerBytes : options.maximumMessageBytes
    )
    const authTimer = resumed
      ? undefined
      : setTimeout(
          () => socket.close(RELAY_CLOSE.unauthorized, 'Expected a pairing token'),
          authTimeoutMs
        )

    async function authenticate(token: string) {
      const pairing = isAgentPairingToken(token) ? await agentPairingId(token) : null
      if (closed) return
      if (!pairing || (options.pairing !== undefined && pairing !== options.pairing)) {
        socket.close(RELAY_CLOSE.unauthorized, 'Invalid pairing token')
        return
      }
      // A transport presents its token again before what it thinks is its expiry.
      if (tab) {
        if (tab.pairing !== pairing) socket.close(RELAY_CLOSE.unauthorized, 'Another pairing')
        return
      }
      clearTimeout(authTimer)
      tab = { id: crypto.randomUUID(), pairing, socket, toolHost: false }
      tabs.add(tab)
      remember(tab)
      welcome(tab)
    }

    return {
      receive(data) {
        if (closed) return
        if (data.byteLength > options.maximumMessageBytes) {
          socket.close(RELAY_CLOSE.messageTooLarge, 'Pairing message is too large')
          return
        }
        const assembled = assembler.push(data)
        if (assembled.type === 'partial') return
        if (assembled.type === 'too-large') {
          socket.close(RELAY_CLOSE.messageTooLarge, 'Pairing message is too large')
          return
        }
        const frame = assembled.type === 'frame' ? decodeRelayClientFrame(assembled.data) : null
        if (!frame) {
          socket.close(RELAY_CLOSE.protocol, 'Malformed pairing frame')
          return
        }
        if (frame.type === 'auth') {
          void authenticate(frame.token)
          return
        }
        if (!tab) {
          socket.close(RELAY_CLOSE.unauthorized, 'Expected a pairing token')
          return
        }
        // The tab speaks only to the hub, and only about tools.
        if (frame.namespace === COLLAB_ACTIONS.agentTools && frame.target === RELAY_SERVER_PEER) {
          calls.receive(tab, frame.payload)
        }
      },
      closed() {
        closed = true
        clearTimeout(authTimer)
        if (!tab) return
        const leaving = tab
        tabs.delete(leaving)
        calls.abandon((waiting) => waiting === leaving)
      }
    }
  }

  return {
    connect(socket: PairingSocket): RelayConnection {
      return open(socket, null)
    },

    /** Takes back a paired tab's socket after the runtime set the hub aside. */
    resume(socket: PairingSocket, state: PairedTabState): RelayConnection {
      const tab: PairedTab = {
        id: state.peerId,
        pairing: state.pairing,
        socket,
        toolHost: state.toolHost
      }
      tabs.add(tab)
      return open(socket, tab)
    },

    /** Runs a call in the tab of `pairing` that offered to run tools last. */
    call(pairing: string, call: AgentToolCall): Promise<AgentToolOutcome> {
      const host = [...tabs].findLast((tab) => tab.pairing === pairing && tab.toolHost)
      if (!host) return Promise.resolve({ ok: false, failure: 'editor_not_open' })
      return calls.call(host, call)
    },

    /** Closes every paired tab, as the runtime shuts down. */
    close() {
      for (const tab of tabs) tab.socket.close(1001, 'Server shutting down')
      tabs.clear()
    }
  }
}

export type AgentPairingHub = ReturnType<typeof createAgentPairingHub>
