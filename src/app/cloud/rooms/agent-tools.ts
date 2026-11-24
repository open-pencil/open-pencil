import {
  decodeAgentToolMessage,
  encodeAgentToolMessage,
  RELAY_SERVER_PEER,
  type AgentToolCall,
  type AgentToolMessage
} from '@open-pencil/cloud/contract'
import { errorMessage } from '@open-pencil/std/errors'
import { isRecord } from '@open-pencil/std/records'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { resolveAutomationTarget } from '@/app/automation/bridge/target'
import { createAutomationToolHandler } from '@/app/automation/bridge/tool-handlers'
import type { CollabAction } from '@/app/collab/transport/types'
import type { EditorStore } from '@/app/editor/session'

/** The longest failure the relay passes on to the app. */
const MAX_ERROR_LENGTH = 4096

/** Runs one call on the tab's document and answers what the tool returned. */
export type RunAgentTool = (
  store: EditorStore,
  call: AgentToolCall,
  signal: AbortSignal
) => Promise<unknown>

let handleTool: ReturnType<typeof createAutomationToolHandler> | null = null

/**
 * Runs an app's call as a local MCP server's runs in the app: on the page the call names or the
 * one on screen, showing the app as an agent at work, its edits one undo step each.
 */
export const runAgentTool: RunAgentTool = async (store, call, signal) => {
  handleTool ??= createAutomationToolHandler(makeFigmaFromStore)
  const { page_id: pageId, ...args } = call.args
  const target = resolveAutomationTarget(store, { page_id: pageId })
  const response = await handleTool(
    target,
    {
      name: call.name,
      args,
      agent: { session: call.agent.session, kind: 'mcp', client: call.agent.client }
    },
    signal
  )
  return isRecord(response) ? response.result : response
}

/**
 * Lets apps the person connected run design tools on the room's document through this tab: the
 * tab tells the relay it runs them each time it reaches the relay, and runs the calls the relay
 * hands it one at a time, in the order they came. A call the relay stopped waiting for is
 * cancelled, and one still waiting for its turn never runs. Only the relay's messages count.
 */
export function serveRoomAgentTools(
  [send, receive]: CollabAction,
  options: {
    store: EditorStore
    /** Follows peers joining the room; returns the unsubscribe. */
    onPeerJoin: (handler: (peerId: string) => void) => () => void
    run?: RunAgentTool
  }
) {
  const run = options.run ?? runAgentTool
  const answer = (message: AgentToolMessage) =>
    send(encodeAgentToolMessage(message), RELAY_SERVER_PEER)
  const calls = new Map<string, AbortController>()
  let turn = Promise.resolve()
  /** Aborted once the tab stops serving the room. */
  const serving = new AbortController()

  async function runInTurn(id: string, call: AgentToolCall, controller: AbortController) {
    try {
      if (serving.signal.aborted) return
      // A call cancelled while it waited for its turn stops here, unanswered, like one cancelled
      // while it ran.
      controller.signal.throwIfAborted()
      const result = await run(options.store, call, controller.signal)
      if (!controller.signal.aborted) answer({ type: 'result', id, ok: true, result })
    } catch (error) {
      if (controller.signal.aborted) return
      const reason = errorMessage(error).slice(0, MAX_ERROR_LENGTH)
      answer({ type: 'result', id, ok: false, error: reason })
    } finally {
      calls.delete(id)
    }
  }

  receive((data, peerId) => {
    if (serving.signal.aborted || peerId !== RELAY_SERVER_PEER) return
    const message = decodeAgentToolMessage(data)
    if (message?.type === 'cancel') {
      calls.get(message.id)?.abort()
      return
    }
    if (message?.type !== 'call') return
    const { id, ...call } = message
    const controller = new AbortController()
    calls.set(id, controller)
    turn = turn.then(() => runInTurn(id, call, controller))
  })

  // Each time the tab reaches the relay, and now in case it already has; until it has, the
  // transport sends nothing, and the relay takes a repeated offer as one.
  const stopJoin = options.onPeerJoin((peerId) => {
    if (peerId === RELAY_SERVER_PEER) answer({ type: 'host' })
  })
  answer({ type: 'host' })

  return {
    stop() {
      serving.abort()
      stopJoin()
      for (const controller of calls.values()) controller.abort()
    }
  }
}
