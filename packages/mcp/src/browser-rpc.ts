import { randomUUID } from 'node:crypto'

import type { WebSocket } from 'ws'

import { isAuthorized } from '#mcp/auth'
import type { RpcJsonObject } from '#mcp/json'
import type { PendingRequest } from '#mcp/rpc-types'

const RPC_TIMEOUT = 20_000

const APP_NOT_CONNECTED_MESSAGE =
  'OpenPencil app is not connected. STOP and tell the user: "The OpenPencil desktop app is not running, no document is open, or the desktop app is connected to a different MCP server. Please start OpenPencil, open a document, and try again." Do NOT attempt to start the app yourself or retry automatically.'

type BrowserRpcBridgeOptions = {
  authToken: string | null
  onConnectionChange: () => void
}

type BrowserMessage = {
  type: string
  id?: string
  token?: string
  result?: unknown
  error?: string
  ok?: boolean
}

function stripEnvelope(msg: BrowserMessage): Record<string, unknown> {
  const { type: _type, id: _id, ...body } = msg
  return body
}

function responsePayload(result: unknown): Record<string, unknown> {
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
  let browserWs: WebSocket | null = null
  let browserRegistered = false

  function currentRpcToken(): string | null {
    return authToken
  }

  function isConnected(): boolean {
    return Boolean(browserWs && browserRegistered)
  }

  function rejectAllPending(reason: string) {
    for (const [id, req] of pending) {
      clearTimeout(req.timer)
      req.reject(new Error(reason))
      pending.delete(id)
    }
  }

  function sendRegisterToken(ws: WebSocket) {
    const token = currentRpcToken()
    sendJson(ws, { type: 'register', token })
  }

  function broadcastRegisterToken() {
    for (const client of clients) sendRegisterToken(client)
  }

  function handleConnection(ws: WebSocket) {
    clients.add(ws)
    sendRegisterToken(ws)
  }

  function sendRpc(body: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
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
    const previousBrowserWs = browserWs
    browserWs = ws
    browserRegistered = true
    if (previousBrowserWs && previousBrowserWs !== ws && previousBrowserWs.readyState === ws.OPEN) {
      previousBrowserWs.close()
      rejectAllPending('Browser reconnected')
    }
    onConnectionChange()
    broadcastRegisterToken()
  }

  function handleBrowserResponse(msg: BrowserMessage, ws: WebSocket) {
    if (!browserRegistered || browserWs !== ws || !msg.id) return
    const req = pending.get(msg.id)
    if (!req) return
    pending.delete(msg.id)
    clearTimeout(req.timer)
    if (msg.ok === false) req.reject(new Error(msg.error ?? 'RPC failed'))
    else req.resolve(stripEnvelope(msg))
  }

  function handleMessage(data: string, ws: WebSocket) {
    let msg: BrowserMessage
    try {
      msg = JSON.parse(data) as BrowserMessage
    } catch (e) {
      console.warn('Malformed automation message:', e)
      return
    }

    if (msg.type === 'register' && msg.token !== undefined) {
      registerBrowser(ws, msg.token as string | null)
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
    if (browserWs !== ws) return
    browserWs = null
    browserRegistered = false
    rejectAllPending('Browser disconnected')
    onConnectionChange()
  }

  function close() {
    rejectAllPending('Server shutting down')
    clients.clear()
  }

  return {
    close,
    currentRpcToken,
    handleClose,
    handleConnection,
    handleMessage,
    isConnected,
    sendRpc
  }
}
