import { RELAY_SERVER_PEER, type CollabAction } from '@open-pencil/collab'
import {
  decodeAutomationMessage,
  encodeAutomationMessage,
  type AutomationMessage
} from '@open-pencil/collab/automation'
import { errorMessage } from '@open-pencil/std/errors'
import { isRecord, type UnknownRecord } from '@open-pencil/std/records'

import { isToolError } from '@/app/ai/tools/runner'
import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import {
  prepareAutomationTarget,
  resolveAutomationTarget,
  stripAutomationTargetArgs
} from '@/app/automation/bridge/target'
import { createAutomationToolHandler } from '@/app/automation/bridge/tool-handlers'
import type { EditorStore } from '@/app/editor/session'

/** Runs a `tool` request on the tab's document and answers what the tool returned. */
export type RunAgentTool = (
  store: EditorStore,
  request: UnknownRecord,
  signal: AbortSignal
) => Promise<unknown>

let handleTool: ReturnType<typeof createAutomationToolHandler> | null = null

/**
 * Runs an app's call with the tool handler a local MCP server's `tool` request runs, once the page
 * is loaded: on the page the call names or the one on screen, showing the app as an agent at work,
 * its edits one undo step each. It works on the room's own document whatever the call names.
 */
export const runAgentTool: RunAgentTool = async (store, request, signal) => {
  handleTool ??= createAutomationToolHandler(makeFigmaFromStore)
  const target = resolveAutomationTarget(store, { page_id: request.page_id })
  await prepareAutomationTarget(target, signal)
  const response = await handleTool(target, stripAutomationTargetArgs(request), signal)
  const result = isRecord(response) ? response.result : response
  // A tool may answer with its error rather than throw it.
  if (isToolError(result)) throw new Error(errorMessage(result.error))
  return result
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
  const answer = (message: AutomationMessage) =>
    send(encodeAutomationMessage(message), RELAY_SERVER_PEER)
  const calls = new Map<string, AbortController>()
  let turn = Promise.resolve()
  /** Aborted once the tab stops serving the room. */
  const serving = new AbortController()

  async function runInTurn(id: string, request: UnknownRecord, controller: AbortController) {
    try {
      if (serving.signal.aborted) return
      // A call cancelled while it waited for its turn stops here, unanswered, like one cancelled
      // while it ran.
      controller.signal.throwIfAborted()
      const result = await run(options.store, request, controller.signal)
      if (!controller.signal.aborted) answer({ type: 'response', id, ok: true, result })
    } catch (error) {
      if (controller.signal.aborted) return
      answer({ type: 'response', id, ok: false, error: errorMessage(error) })
    } finally {
      calls.delete(id)
    }
  }

  receive((data, peerId) => {
    if (serving.signal.aborted || peerId !== RELAY_SERVER_PEER) return
    const message = decodeAutomationMessage(data)
    if (message?.type === 'cancel') {
      calls.get(message.id)?.abort()
      return
    }
    if (message?.type !== 'request') return
    const { id, command, args } = message
    // The relay sends tool calls alone: the rest of what a local MCP server may ask, such as
    // opening files or running code, stays the local server's.
    if (command !== 'tool' || !isRecord(args)) {
      answer({ type: 'response', id, ok: false, error: `Unknown command: ${command}` })
      return
    }
    const controller = new AbortController()
    calls.set(id, controller)
    turn = turn.then(() => runInTurn(id, args, controller))
  })

  // Each time the tab reaches the relay, and now in case it already has; until it has, the
  // transport sends nothing, and the relay takes a repeated offer as one.
  const stopJoin = options.onPeerJoin((peerId) => {
    if (peerId === RELAY_SERVER_PEER) answer({ type: 'register' })
  })
  answer({ type: 'register' })

  return {
    stop() {
      serving.abort()
      stopJoin()
      for (const controller of calls.values()) controller.abort()
    }
  }
}
