import { WebSocket } from 'ws'

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

type StdioRpcBridgeOptions = {
  wsUrl: string
  reconnectDelayMs?: number
  onOpen?: () => void
  onMalformedMessage?: () => void
}

const RPC_TIMEOUT = 30_000
const DISCONNECTED_MESSAGE =
  'OpenPencil app is not connected. ' +
  'STOP and tell the user: "The OpenPencil desktop app is not running or no document is open. ' +
  'Please start the app and open a document, then try again." ' +
  'Do NOT attempt to start the app yourself or retry automatically.'

function wsMessageToString(raw: WebSocket.RawData): string {
  if (Buffer.isBuffer(raw)) return raw.toString('utf8')
  if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8')
  return Buffer.from(raw).toString('utf8')
}

export function createStdioRpcBridge({
  wsUrl,
  reconnectDelayMs = 2000,
  onOpen,
  onMalformedMessage,
}: StdioRpcBridgeOptions) {
  const pending = new Map<string, PendingRequest>()
  let ws: WebSocket | null = null
  let registered = false

  function rejectAllPending(reason: string) {
    for (const [id, req] of pending) {
      clearTimeout(req.timer)
      req.reject(new Error(reason))
      pending.delete(id)
    }
  }

  function connect() {
    ws = new WebSocket(wsUrl)

    ws.on('open', () => {
      onOpen?.()
    })

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(wsMessageToString(raw)) as {
          type: string
          id?: string
          token?: string
          result?: unknown
          error?: string
          ok?: boolean
        }
        if (msg.type === 'register' && msg.token) {
          registered = true
          return
        }
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
      } catch {
        onMalformedMessage?.()
      }
    })

    ws.on('close', () => {
      registered = false
      rejectAllPending('WebSocket closed')
      setTimeout(connect, reconnectDelayMs)
    })

    ws.on('error', () => {
      ws?.close()
    })
  }

  function sendRpc(body: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN || !registered) {
        reject(new Error(DISCONNECTED_MESSAGE))
        return
      }
      const id = crypto.randomUUID()
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error('RPC timeout (30s)'))
      }, RPC_TIMEOUT)
      pending.set(id, { resolve, reject, timer })
      ws.send(JSON.stringify({ type: 'request', id, ...body }))
    })
  }

  return { connect, sendRpc }
}
