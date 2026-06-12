import { randomUUID } from 'node:crypto'

import type { WebSocket } from 'ws'

import { isAuthorized } from '#mcp/auth'
import type { RpcJsonObject } from '#mcp/json'
import type { PendingRequest } from '#mcp/rpc-types'

const RPC_TIMEOUT = 20_000
const APP_WAIT_TIMEOUT = 10_000

const APP_NOT_CONNECTED_MESSAGE =
  'OpenPencil app is not connected. STOP and tell the user: "The OpenPencil desktop app is not running, no document is open, or the desktop app is connected to a different MCP server. Please start OpenPencil, open a document, and try again." Do NOT attempt to start the app yourself or retry automatically.'

type BrowserRpcBridgeOptions = {
  authToken: string | null
  onConnectionChange: () => void
}

type BrowserMessage = {
  type: string
  id?: string
  token?: unknown
  result?: unknown
  error?: string
  ok?: boolean
}

function stripEnvelope(msg: BrowserMessage): Record<string, unknown> {
  const { type: _type, id: _id, ...body } = msg
  return body
}

function responsePayload(result: unknown): RpcJsonObject {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    return result as RpcJsonObject
  }
  return { result }
}

function sendJson(ws: WebSocket, body: Record<string, unknown>) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(body))
}

function createSettler<T>(resolve: (value: T) => void, reject: (error: Error) => void) {
  let settled = false
  return {
    resolve: (value: T) => {
      if (settled) return
      settled = true
      resolve(value)
    },
    reject: (error: Error) => {
      if (settled) return
      settled = true
      reject(error)
    },
    isSettled: () => settled
  }
}

export function createBrowserRpcBridge({ authToken, onConnectionChange }: BrowserRpcBridgeOptions) {
  const pending = new Map<string, PendingRequest>()
  const clients = new Set<WebSocket>()
  const connectionWaiters = new Set<PendingRequest>()
  // Track which WebSocket clients have authenticated via a valid
  // register message. Unauthenticated clients can only send register;
  // all other message types (request, response) are rejected.
  const authenticatedClients = new Set<WebSocket>()
  let browserWs: WebSocket | null = null
  let browserRegistered = false

  function isConnected(): boolean {
    return Boolean(browserWs && browserRegistered)
  }

  function notifyConnectionWaiters() {
    for (const waiter of connectionWaiters) {
      clearTimeout(waiter.timer)
      waiter.resolve(undefined)
    }
    connectionWaiters.clear()
  }

  function rejectConnectionWaiters(reason: string) {
    for (const waiter of connectionWaiters) {
      clearTimeout(waiter.timer)
      waiter.reject(new Error(reason))
    }
    connectionWaiters.clear()
  }

  function waitForConnection(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let waiter: PendingRequest | null = null

      const timer = setTimeout(() => {
        if (waiter) connectionWaiters.delete(waiter)
        reject(new Error(APP_NOT_CONNECTED_MESSAGE))
      }, APP_WAIT_TIMEOUT)

      waiter = {
        resolve: () => {
          clearTimeout(timer)
          resolve()
        },
        reject: (error: Error) => {
          clearTimeout(timer)
          reject(error)
        },
        timer
      }
      connectionWaiters.add(waiter)
    })
  }

  function rejectAllPending(reason: string) {
    for (const [, req] of pending) {
      clearTimeout(req.timer)
      req.reject(new Error(reason))
    }
    pending.clear()
  }

  function sendRegisterPrompt(ws: WebSocket) {
    // Send a prompt inviting the client to register as the browser.
    // IMPORTANT: Do NOT include the auth token here. On TCP, any local
    // process can connect via WebSocket — sending the secret token would
    // leak credentials to unauthenticated clients. The legitimate browser
    // app already knows the token (from the discovery file or Vite env)
    // and sends it proactively in its ws.onopen handler. The token field
    // is set to null to signal that auth is required without revealing
    // the secret. When auth is disabled (authToken === null), null is
    // still correct — it means "no token needed."
    sendJson(ws, { type: 'register', token: null })
  }

  function broadcastRegisterPrompt() {
    for (const client of clients) sendRegisterPrompt(client)
  }

  function sendRpc(body: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const doSend = () => {
        const ws = browserWs
        if (!ws || ws.readyState !== ws.OPEN || !browserRegistered) {
          reject(new Error(APP_NOT_CONNECTED_MESSAGE))
          return
        }
        const id = randomUUID()
        const settle = createSettler(resolve, reject)
        const timer = setTimeout(() => {
          pending.delete(id)
          settle.reject(new Error(`RPC timeout (${Math.round(RPC_TIMEOUT / 1000)}s)`))
        }, RPC_TIMEOUT)
        pending.set(id, { resolve: settle.resolve, reject: settle.reject, timer })
        try {
          ws.send(JSON.stringify({ type: 'request', id, ...body }))
        } catch (e) {
          clearTimeout(timer)
          pending.delete(id)
          if (!settle.isSettled()) {
            settle.reject(e instanceof Error ? e : new Error(String(e)))
          }
        }
      }

      if (browserWs && browserWs.readyState === browserWs.OPEN && browserRegistered) {
        doSend()
      } else {
        void waitForConnection().then(doSend).catch(reject)
      }
    })
  }

  async function handleClientRequest(ws: WebSocket, msg: BrowserMessage) {
    if (!msg.id) return
    try {
      const result = await sendRpc(stripEnvelope(msg))
      sendJson(ws, { type: 'response', id: msg.id, ok: true, ...responsePayload(result) })
    } catch (e) {
      sendJson(ws, {
        type: 'response',
        id: msg.id,
        ok: false,
        error: e instanceof Error ? e.message : String(e)
      })
    }
  }

  function registerBrowser(ws: WebSocket, token: string | null) {
    if (!isAuthorized(token, authToken)) {
      ws.close()
      return
    }
    // Mark this client as authenticated — it can now send requests.
    authenticatedClients.add(ws)
    const previousBrowserWs = browserWs
    browserWs = ws
    browserRegistered = true
    if (previousBrowserWs && previousBrowserWs !== ws) {
      // Reject in-flight requests to the old browser. Without this, pending
      // requests sit in the pending map until RPC_TIMEOUT (20s), because
      // handleClose for the old socket returns early (browserWs is already
      // set to the new socket, so browserWs !== previousBrowserWs).
      rejectAllPending('Browser reconnected')
      if (previousBrowserWs.readyState === ws.OPEN) {
        previousBrowserWs.close()
      }
    }
    notifyConnectionWaiters()
    onConnectionChange()
    broadcastRegisterPrompt()
  }

  function handleBrowserResponse(msg: BrowserMessage, ws: WebSocket) {
    if (!browserRegistered || browserWs !== ws || !msg.id) return
    const req = pending.get(msg.id)
    if (!req) return
    pending.delete(msg.id)
    clearTimeout(req.timer)
    if (msg.ok === false) {
      req.reject(new Error(msg.error ?? 'RPC failed'))
    } else {
      req.resolve(stripEnvelope(msg))
    }
  }

  function handleMessage(data: string, ws: WebSocket) {
    let msg: BrowserMessage
    try {
      msg = JSON.parse(data) as BrowserMessage
    } catch (e) {
      console.warn('Malformed automation message:', e)
      return
    }

    if (msg.type === 'auth') {
      // Authenticate a stdio bridge client without registering it as the
      // browser app. This lets the client send request/response messages
      // without becoming the RPC target. The token is validated the same
      // way as registerBrowser — when auth is disabled (authToken === null),
      // any token is accepted.
      if (msg.token === null || typeof msg.token === 'string') {
        if (!isAuthorized(msg.token, authToken)) {
          ws.close()
          return
        }
        authenticatedClients.add(ws)
      } else if (msg.token !== undefined) {
        ws.close()
      }
      return
    }

    if (msg.type === 'register') {
      if (msg.token === null || typeof msg.token === 'string') {
        registerBrowser(ws, msg.token)
      } else if (msg.token !== undefined) {
        ws.close()
      }
      return
    }
    // All non-register messages require authentication. Without this
    // check, an unauthenticated WebSocket client (that hasn't sent a
    // valid register message) could bypass the HTTP auth on /rpc by
    // sending request messages over the WebSocket directly.
    if (!authenticatedClients.has(ws)) {
      ws.close()
      return
    }
    if (msg.type === 'request') {
      void handleClientRequest(ws, msg)
      return
    }
    if (msg.type === 'response') handleBrowserResponse(msg, ws)
  }

  function handleClose(ws: WebSocket) {
    clients.delete(ws)
    authenticatedClients.delete(ws)
    if (browserWs !== ws) return
    browserWs = null
    browserRegistered = false
    rejectAllPending('Browser disconnected')
    // Intentionally NOT rejecting connectionWaiters here. If a request
    // entered waitForConnection() before the close event (e.g. during a
    // CLOSING→CLOSED transition), the waiter should keep waiting the full
    // APP_WAIT_TIMEOUT for a reconnect. registerBrowser will resolve it
    // via notifyConnectionWaiters if the browser reconnects in time.
    onConnectionChange()
  }

  function handleConnection(ws: WebSocket) {
    clients.add(ws)
    // Transport security restricts WHO can connect: Unix socket with
    // 0o600 permissions (same-user only) or TCP localhost (any local
    // process). The authenticatedClients set gates WHAT connected clients
    // can do: only those that sent a valid register message may forward
    // requests. The register prompt does NOT include the auth token —
    // the browser app sends the token proactively (from the discovery
    // file or Vite env).
    sendRegisterPrompt(ws)
  }

  function close() {
    rejectAllPending('Server shutting down')
    rejectConnectionWaiters('Server shutting down')
    clients.clear()
  }

  return {
    close,
    isConnected,
    sendRpc,
    handleConnection,
    handleMessage,
    handleClose
  }
}
