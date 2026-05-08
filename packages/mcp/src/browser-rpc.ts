import { randomUUID } from 'node:crypto'

import type { WebSocket } from 'ws'

const RPC_TIMEOUT = 30_000

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

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

export function createBrowserRpcBridge({ authToken, onConnectionChange }: BrowserRpcBridgeOptions) {
  const pending = new Map<string, PendingRequest>()
  let browserWs: WebSocket | null = null
  let browserToken: string | null = null
  let browserRegistered = false

  function currentRpcToken(): string | null {
    return authToken ?? browserToken
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

  function sendRpc(body: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!browserWs || browserWs.readyState !== browserWs.OPEN || !browserRegistered) {
        reject(new Error('OpenPencil app is not connected'))
        return
      }
      const id = randomUUID()
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error('RPC timeout (30s)'))
      }, RPC_TIMEOUT)
      pending.set(id, { resolve, reject, timer })
      browserWs.send(JSON.stringify({ type: 'request', id, ...body }))
    })
  }

  function handleMessage(msg: BrowserMessage, ws: WebSocket) {
    try {
      if (msg.type === 'register' && msg.token) {
        if (authToken && msg.token !== authToken) {
          ws.close()
          return
        }
        if (browserWs && browserWs !== ws && browserWs.readyState === ws.OPEN) {
          browserWs.close()
          rejectAllPending('Browser reconnected')
        }
        browserWs = ws
        browserToken = msg.token
        browserRegistered = true
        onConnectionChange()
        return
      }
      if (!browserRegistered || browserWs !== ws) return
      if (msg.type === 'response' && msg.id) {
        const req = pending.get(msg.id)
        if (!req) return
        pending.delete(msg.id)
        clearTimeout(req.timer)
        if (msg.ok === false) req.reject(new Error(msg.error ?? 'RPC failed'))
        else {
          const { type: _, id: __, ...payload } = msg
          req.resolve(payload)
        }
      }
    } catch (e) {
      console.warn('Malformed automation message:', e)
    }
  }

  function handleClose(ws: WebSocket) {
    if (browserWs !== ws) return
    browserWs = null
    browserToken = null
    browserRegistered = false
    rejectAllPending('Browser disconnected')
    onConnectionChange()
  }

  function close() {
    rejectAllPending('Server shutting down')
  }

  return { close, currentRpcToken, handleClose, handleMessage, isConnected, sendRpc }
}
