#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { WebSocket } from 'ws'

import { MCP_VERSION, registerTools } from './server.js'

const wsPort = parseInt(process.env.WS_PORT ?? '7601', 10)
const wsHost = process.env.HOST ?? '127.0.0.1'
const enableEval = process.env.OPENPENCIL_MCP_EVAL === '1'

const wsUrl = `ws://${wsHost}:${wsPort}`
let ws: WebSocket | null = null
let registered = false

const pending = new Map<
  string,
  {
    resolve: (v: unknown) => void
    reject: (e: Error) => void
    timer: ReturnType<typeof setTimeout>
  }
>()

function connect() {
  ws = new WebSocket(wsUrl)

  ws.on('open', () => {
    process.stderr.write(`Connected to OpenPencil app at ${wsUrl}\n`)
  })

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(String(raw)) as {
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
      process.stderr.write('Malformed WS message\n')
    }
  })

  ws.on('close', () => {
    registered = false
    for (const [id, req] of pending) {
      clearTimeout(req.timer)
      req.reject(new Error('WebSocket closed'))
      pending.delete(id)
    }
    setTimeout(connect, 2000)
  })

  ws.on('error', () => {
    ws?.close()
  })
}

function sendRpc(body: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN || !registered) {
      reject(new Error('OpenPencil app is not connected. Start the app and open a document.'))
      return
    }
    const id = crypto.randomUUID()
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('RPC timeout (30s)'))
    }, 30_000)
    pending.set(id, { resolve, reject, timer })
    ws.send(JSON.stringify({ type: 'request', id, ...body }))
  })
}

connect()

const mcpServer = new McpServer({ name: 'open-pencil', version: MCP_VERSION })
registerTools(mcpServer, { enableEval, sendRpc })

const transport = new StdioServerTransport()
void mcpServer.connect(transport)
