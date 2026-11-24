import {
  COLLAB_ACTIONS,
  decodeAgentToolMessage,
  encodeAgentToolMessage,
  RELAY_SERVER_PEER,
  type AgentToolCall,
  type AgentToolMessage,
  type AgentToolOutcome
} from '#cloud/contract'

import { DEADLINE_MS } from '@open-pencil/std/timing'

import type { RelayPeer } from './connection'
import { send } from './room'

/** How long the relay waits for an editor to answer a call before it cancels it. */
export const AGENT_TOOL_TIMEOUT_MS = DEADLINE_MS.slowRequest

type PendingCall = {
  peer: RelayPeer
  settle: (outcome: AgentToolOutcome) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * Whether a peer may run apps' calls for the person its ticket names: an editor signed in as that
 * person, so an app's edits are theirs and reach nothing their own editing would not.
 */
export function mayHostTools(peer: Pick<RelayPeer, 'authorization'>): boolean {
  return peer.authorization.permission === 'edit' && peer.authorization.principal.kind === 'user'
}

function deliver(peer: RelayPeer, message: AgentToolMessage) {
  send(peer.socket, {
    type: 'message',
    namespace: COLLAB_ACTIONS.agentTools,
    from: RELAY_SERVER_PEER,
    payload: encodeAgentToolMessage(message)
  })
}

/**
 * The calls the relay carries from apps to editors, and the answers back. A call goes to one
 * editor and waits only for that editor: another peer's answer is ignored, and the call fails when
 * that editor leaves or does not answer in time, when the relay also cancels it there.
 */
export function createAgentToolCalls(options: {
  timeoutMs?: number
  /** Keeps a peer's state after it starts running tools, for a relay that can be set aside. */
  remember: (peer: RelayPeer) => void
}) {
  const timeoutMs = options.timeoutMs ?? AGENT_TOOL_TIMEOUT_MS
  const pending = new Map<string, PendingCall>()

  function finish(id: string, outcome: AgentToolOutcome) {
    const call = pending.get(id)
    if (!call) return
    pending.delete(id)
    clearTimeout(call.timer)
    call.settle(outcome)
  }

  return {
    /** Takes an `agent-tools` message a peer sent the relay. */
    receive(peer: RelayPeer, payload: Uint8Array) {
      const message = decodeAgentToolMessage(payload)
      if (!message) return
      if (message.type === 'host') {
        if (!mayHostTools(peer) || peer.toolHost) return
        peer.toolHost = true
        options.remember(peer)
        return
      }
      if (message.type !== 'result' || pending.get(message.id)?.peer !== peer) return
      finish(
        message.id,
        message.ok
          ? { ok: true, result: message.result }
          : { ok: false, failure: 'tool_failed', message: message.error }
      )
    },

    /** Hands a call to `host` and waits for its answer. */
    call(host: RelayPeer, call: AgentToolCall): Promise<AgentToolOutcome> {
      const id = crypto.randomUUID()
      return new Promise((settle) => {
        const timer = setTimeout(() => {
          if (!pending.has(id)) return
          finish(id, { ok: false, failure: 'timeout' })
          deliver(host, { type: 'cancel', id })
        }, timeoutMs)
        pending.set(id, { peer: host, settle, timer })
        deliver(host, { type: 'call', id, ...call })
      })
    },

    /** Fails every call waiting on a peer that left or whose room ended. */
    abandon(left: (peer: RelayPeer) => boolean) {
      for (const [id, call] of pending) {
        if (left(call.peer)) {
          finish(id, {
            ok: false,
            failure: 'tool_failed',
            message: 'The editor closed the document'
          })
        }
      }
    }
  }
}
