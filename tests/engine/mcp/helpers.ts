import { WebSocket } from 'ws'

import {
  type SceneGraph,
  ALL_TOOLS,
  FigmaAPI,
  computeAllLayouts,
  executeRpcCommand
} from '@open-pencil/core'

export interface HealthResponse {
  status: string
  version: string
  authRequired: boolean
  discoveryPath: string
}

export interface MockBrowserRequest {
  command: string
  args?: unknown
}

export interface MockBrowser {
  ws: WebSocket
  graph: SceneGraph
  requests: MockBrowserRequest[]
  close: () => void
}

/** Generate a random hex string of the given byte length using crypto.getRandomValues(). */
function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes)
  globalThis.crypto.getRandomValues(buf)
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function connectMockBrowser(
  port: number,
  graph: SceneGraph,
  authToken?: string
): Promise<MockBrowser> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`)
    const requests: MockBrowserRequest[] = []
    const token = authToken ?? 'test-token-' + randomHex(8)

    let settled = false

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'register', token }))

      ws.on('message', async (raw) => {
        let msg: { type: string; id: string; command: string; args?: unknown }
        try {
          msg = JSON.parse(raw.toString())
        } catch {
          return // Ignore malformed payloads
        }
        if (msg.type !== 'request') return

        try {
          const command = msg.command
          requests.push({ command, args: msg.args })
          const args = msg.args as { name?: string; args?: Record<string, unknown> } | undefined

          let result: unknown
          if (command === 'tool' && args?.name) {
            const def = ALL_TOOLS.find((t) => t.name === args.name)
            if (!def) throw new Error(`Unknown tool: ${args.name}`)
            const api = new FigmaAPI(graph)
            const pages = graph.getPages()
            if (pages.length === 0) throw new Error('No pages in graph')
            api.currentPage = api.wrapNode(pages[0].id)
            result = await def.execute(api, args.args ?? {})
            if (def.mutates) computeAllLayouts(graph)
          } else if (
            command === 'save_file' ||
            command === 'new_document' ||
            command === 'open_file'
          ) {
            result = {}
          } else {
            result = executeRpcCommand(graph, command, args ?? {})
          }

          ws.send(JSON.stringify({ type: 'response', id: msg.id, ok: true, result }))
        } catch (e) {
          ws.send(
            JSON.stringify({
              type: 'response',
              id: msg.id,
              ok: false,
              error: e instanceof Error ? e.message : String(e)
            })
          )
        }
      })

      if (!settled) {
        settled = true
        resolve({ ws, graph, requests, close: () => ws.close() })
      }
    })

    ws.on('error', (err) => {
      if (!settled) {
        settled = true
        reject(err)
      }
    })
  })
}

export async function waitForBrowserRegistration(port: number, timeoutMs = 5000): Promise<void> {
  const start = Date.now()
  let lastStatus = 'unknown'
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/health`)
      const health = (await resp.json()) as HealthResponse
      lastStatus = health.status
      if (health.status === 'ok') return
    } catch {
      void 0
    }
    await new Promise<void>((r) => {
      setTimeout(r, 100)
    })
  }
  throw new Error(
    `Browser registration not confirmed within ${timeoutMs}ms (last status: ${lastStatus})`
  )
}
