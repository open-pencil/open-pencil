/**
 * Browser-side automation handler.
 *
 * Connects to the bridge via WebSocket, receives RPC requests,
 * executes them against the live EditorStore, and sends results back.
 */
import { AUTOMATION_HTTP_PORT } from '@open-pencil/core/constants'
import { randomHex } from '@open-pencil/core/random'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { createAutomationCommandHandlers } from '@/app/automation/bridge/handlers'
import type { EditorStore } from '@/app/editor/active-store'

const BASE_RECONNECT_MS = 1_000
const MAX_RECONNECT_MS = 30_000

/**
 * Exponential backoff, capped, with jitter.
 *
 * Retrying forever is right — someone may start the MCP server after opening
 * the page, and they should not have to reload. Retrying every two seconds
 * forever is not: the cap keeps a session that will never have a bridge down
 * to one attempt every 30s instead of 1,800 an hour.
 */
function backoffMs(attempt: number): number {
  const exponential = Math.min(MAX_RECONNECT_MS, BASE_RECONNECT_MS * 2 ** (attempt - 1))
  const jitter = (crypto.getRandomValues(new Uint8Array(1))[0] ?? 0) / 256
  return Math.round(exponential * (0.8 + 0.4 * jitter))
}

export function connectAutomation(getStore: () => EditorStore, authToken: string | null = null) {
  const token = authToken ?? randomHex(32)
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let intentionalDisconnect = false
  let attempts = 0
  /**
   * Whether the absence of a bridge has already been reported.
   *
   * Not running the MCP server is the normal case — a plain browser session, a
   * CI run, anyone who does not use automation. Retrying every 2s and logging
   * a warning on both `onerror` and `onclose` produced three console lines
   * every two seconds indefinitely, which makes the console useless for
   * everything else.
   */
  let reportedUnavailable = false

  const { handleRequest: handleAutomationRequest } =
    createAutomationCommandHandlers(makeFigmaFromStore)

  async function handleRequest(_id: string, command: string, args: unknown): Promise<unknown> {
    return handleAutomationRequest(getStore(), command, args)
  }

  function connect() {
    let socket: WebSocket
    try {
      socket = new WebSocket(`ws://127.0.0.1:${AUTOMATION_HTTP_PORT}`)
      ws = socket
    } catch (e) {
      console.debug(
        '[Automation] WebSocket constructor failed:',
        e instanceof Error ? e.message : e
      )
      scheduleReconnect()
      return
    }

    socket.onopen = () => {
      attempts = 0
      reportedUnavailable = false
      console.debug('[Automation] WebSocket connected to MCP server')
      socket.send(JSON.stringify({ type: 'register', token }))
    }

    socket.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data) as {
          type: string
          id: string
          command: string
          args?: unknown
        }
        if (msg.type !== 'request' || !msg.id) return
        try {
          const result = await handleRequest(msg.id, msg.command, msg.args)
          socket.send(JSON.stringify({ type: 'response', id: msg.id, ...(result as object) }))
        } catch (e) {
          socket.send(
            JSON.stringify({
              type: 'response',
              id: msg.id,
              ok: false,
              error: e instanceof Error ? e.message : String(e)
            })
          )
        }
      } catch (e) {
        console.warn('Failed to parse WebSocket message:', e)
      }
    }

    socket.onclose = (event) => {
      if (ws === socket) ws = null
      if (intentionalDisconnect || event.code === 1000) return
      scheduleReconnect()
    }

    // Deliberately silent: a failed connection always closes too, so logging
    // here as well doubled every message. `onclose` owns the reporting.
    socket.onerror = () => socket.close()
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer)
    if (!reportedUnavailable) {
      reportedUnavailable = true
      console.debug(
        `[Automation] No bridge on 127.0.0.1:${AUTOMATION_HTTP_PORT}. ` +
          'Retrying quietly; run the MCP server to enable automation.'
      )
    }
    reconnectTimer = setTimeout(connect, backoffMs(++attempts))
  }

  function disconnect() {
    intentionalDisconnect = true
    clearTimeout(reconnectTimer)
    ws?.close()
    ws = null
  }

  connect()
  return { disconnect, token }
}
