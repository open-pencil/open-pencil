import {
  agentPairingId,
  createRelayClientAssembler,
  decodeRelayClientFrame,
  isAgentPairingToken,
  RELAY_CLOSE,
  type AgentToolCall,
  type AgentToolOutcome
} from '#cloud/contract'
import { createAgentToolCalls } from '#cloud/server/collaboration/relay/agent-tools'
import type { RelayConnection, RelaySocket } from '#cloud/server/collaboration/relay/connection'
import { send } from '#cloud/server/collaboration/relay/room'
import * as v from 'valibot'

import { COLLAB_ACTIONS, RELAY_SERVER_PEER } from '@open-pencil/collab'
import { DEADLINE_MS, SECOND_MS } from '@open-pencil/std/timing'

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

/**
 * How long a call waits for a tab to offer when none has: an agent may call as soon as its sign-in
 * opens the editor, which takes a few seconds to load.
 */
const EDITOR_WAIT_MS = 10 * SECOND_MS

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
  /** How long a call waits for a tab of its pairing to offer when none has. */
  editorWaitMs?: number
}

/**
 * Carries a coding agent's design tool calls to the editor tab paired with it. A tab connects and
 * presents its pairing token, the relay's welcome names the hub as its one peer, the tab offers
 * to run tools, and each call goes to the tab of that pairing that offered last. Nothing is kept
 * beyond the open sockets: a call to a pairing with no tab waits a few seconds for one to offer,
 * then answers that nobody has it open.
 */
export function createAgentPairingHub(options: AgentPairingHubOptions) {
  const tabs = new Set<PairedTab>()
  const calls = createAgentToolCalls<PairedTab>({
    timeoutMs: options.toolTimeoutMs,
    mayHost: () => true,
    remember
  })
  const authTimeoutMs = options.authTimeoutMs ?? DEADLINE_MS.request
  const editorWaitMs = options.editorWaitMs ?? EDITOR_WAIT_MS
  /** Calls waiting for a tab of their pairing to offer, each told when one does. */
  const waiting = new Set<{ pairing: string; offered(): void }>()

  function remember(tab: PairedTab) {
    // The tab that offered last comes last, where a call looks for its host.
    if (tab.toolHost && tabs.delete(tab)) tabs.add(tab)
    tab.socket.remember?.({ pairing: tab.pairing, peerId: tab.id, toolHost: tab.toolHost })
    if (!tab.toolHost) return
    for (const waiter of waiting) if (waiter.pairing === tab.pairing) waiter.offered()
  }

  function hostOf(pairing: string): PairedTab | undefined {
    return [...tabs].findLast((tab) => tab.pairing === pairing && tab.toolHost)
  }

  /** The pairing's host once a tab offers, or nothing if none does in time. */
  function offerOf(pairing: string): Promise<PairedTab | undefined> {
    return new Promise((resolve) => {
      const waiter = {
        pairing,
        offered() {
          clearTimeout(timer)
          waiting.delete(waiter)
          resolve(hostOf(pairing))
        }
      }
      const timer = setTimeout(() => waiter.offered(), editorWaitMs)
      waiting.add(waiter)
    })
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

    /**
     * Runs a call in the tab of `pairing` that offered to run tools last, waiting a few seconds for
     * one when none has.
     */
    async call(pairing: string, call: AgentToolCall): Promise<AgentToolOutcome> {
      const host = hostOf(pairing) ?? (await offerOf(pairing))
      if (!host) return { ok: false, failure: 'editor_not_open' }
      return calls.call(host, call)
    },

    /** Closes every paired tab, as the runtime shuts down. */
    close() {
      for (const tab of tabs) tab.socket.close(1001, 'Server shutting down')
      tabs.clear()
      for (const waiter of waiting) waiter.offered()
    }
  }
}

export type AgentPairingHub = ReturnType<typeof createAgentPairingHub>
