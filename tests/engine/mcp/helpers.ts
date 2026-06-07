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

export function connectMockBrowser(
  port: number,
  graph: SceneGraph,
  authToken?: string
): Promise<MockBrowser> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`)
    const requests: MockBrowserRequest[] = []
    const token = authToken ?? 'test-token-' + Date.now()

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'register', token }))

      ws.on('message', async (raw) => {
        const msg = JSON.parse(raw.toString()) as {
          type: string
          id: string
          command: string
          args?: unknown
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
            api.currentPage = api.wrapNode(graph.getPages()[0].id)
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

      resolve({ ws, graph, requests, close: () => ws.close() })
    })

    ws.on('error', reject)
  })
}
