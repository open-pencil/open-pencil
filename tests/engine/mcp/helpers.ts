import { type RequestOptions, request as httpRequest } from 'node:http'

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

/** Read the next WebSocket JSON message with a timeout. */
export function readWsJson<T>(ws: WebSocket, timeoutMs = 1000): Promise<T> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      ws.off('message', onMessage)
      ws.off('error', onError)
    }
    const onMessage = (raw: WebSocket.RawData) => {
      cleanup()
      try {
        resolve(JSON.parse(raw.toString()) as T)
      } catch (error) {
        reject(error)
      }
    }
    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out waiting for WebSocket message'))
    }, timeoutMs)
    ws.on('message', onMessage)
    ws.on('error', onError)
  })
}

/** Open a WebSocket connection, optionally authenticating as a stdio bridge client. */
export function openWs(url: string, authToken?: string | null): Promise<WebSocket> {
  const ws = new WebSocket(url)
  return new Promise((resolve, reject) => {
    ws.once('open', () => {
      if (authToken) {
        // Authenticate as a stdio bridge client (not the browser app).
        // The "auth" message type validates the token and adds the client
        // to authenticatedClients without replacing the registered browser.
        ws.send(JSON.stringify({ type: 'auth', token: authToken }))
      }
      resolve(ws)
    })
    ws.once('error', reject)
  })
}

/** Read the next WebSocket JSON message, skipping any 'register' broadcasts. */
export async function readNextResponse<T>(ws: WebSocket, timeoutMs = 5000): Promise<T> {
  const start = Date.now()
  for (let i = 0; ; i++) {
    const remaining = timeoutMs - (Date.now() - start)
    if (remaining <= 0) throw new Error(`Timed out after reading ${i} register messages`)
    const msg = await readWsJson<T & { type: string }>(ws, remaining)
    if (msg.type !== 'register') return msg
  }
}

/** Low-level HTTP request via Node's http module, with timeout. */
export function nodeHttpRequest(
  opts: RequestOptions,
  bodyJson?: string,
  timeoutMs = 5_000
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(opts, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        clearTimeout(timeout)
        const raw = Buffer.concat(chunks).toString('utf-8')
        let data: unknown
        try {
          data = JSON.parse(raw)
        } catch {
          data = raw
        }
        resolve({ status: res.statusCode ?? 200, data })
      })
      res.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })
    const timeout = setTimeout(() => {
      req.destroy(new Error(`nodeHttpRequest timed out after ${timeoutMs / 1000}s`))
    }, timeoutMs)
    req.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
    // Connection-level timeout: destroys the socket if the server stalls
    // during connection or mid-request. The response-level timeout above
    // handles slow responses; this handles hung connections (e.g., socket
    // exists but no one is listening).
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`nodeHttpRequest connection timed out after ${timeoutMs / 1000}s`))
    })
    if (bodyJson) req.write(bodyJson)
    req.end()
  })
}

/** Make an HTTP request via TCP to a specific port. */
export function tcpRequest(
  port: number,
  method: string,
  path: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
): Promise<{ status: number; data: unknown }> {
  if (!port) throw new Error('tcpRequest: port not initialized — beforeAll must run first')
  const bodyJson = body ? JSON.stringify(body) : undefined
  return nodeHttpRequest(
    {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: { ...(bodyJson ? { 'Content-Type': 'application/json' } : {}), ...headers }
    },
    bodyJson
  )
}

/** Make an HTTP request via Unix domain socket. */
export function socketRequest(
  socketPath: string,
  method: string,
  path: string,
  headers?: Record<string, string>
): Promise<{ status: number; data: unknown }> {
  return nodeHttpRequest({ socketPath, path, method, headers: headers ?? {} })
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
          } else if (command === 'list_documents') {
            result = {
              documents: [
                {
                  id: 'doc-1',
                  name: 'Mock document',
                  active: true,
                  current_page_id: graph.getPages()[0].id,
                  current_page_name: graph.getPages()[0].name,
                  pages: graph.getPages().map((page) => ({ id: page.id, name: page.name }))
                }
              ]
            }
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
        // Wait for the server to confirm browser registration before resolving.
        // Without this, follow-up test traffic can start before the server marks
        // the browser as connected, causing race conditions.
        void waitForBrowserRegistration(port).then(() => {
          resolve({ ws, graph, requests, close: () => ws.close() })
          return undefined
        }, reject)
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
