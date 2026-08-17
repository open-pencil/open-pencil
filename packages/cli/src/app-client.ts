import { request as httpRequest } from 'node:http'
import type { IncomingMessage } from 'node:http'

import { readDiscoveryFile } from '@open-pencil/mcp/discovery'
import type { DiscoveryInfo } from '@open-pencil/mcp/discovery'
import { platformHasUnixSockets } from '@open-pencil/mcp/transport'

/** Maximum time to wait for a single RPC request before giving up. */
const RPC_TIMEOUT_MS = 30_000

let cachedInfo: DiscoveryInfo | null = null

async function resolveDiscovery(): Promise<DiscoveryInfo> {
  if (cachedInfo) return cachedInfo

  const info = await readDiscoveryFile()
  if (!info) {
    throw new Error(
      'Could not read MCP discovery file.\n' +
        'Is the app running? Start it with: bun run tauri dev'
    )
  }

  cachedInfo = info
  return cachedInfo
}

function doRequest(
  info: DiscoveryInfo,
  path: string,
  method: string,
  body?: Record<string, unknown>,
  forceTcp = false
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const bodyJSON = body ? JSON.stringify(body) : undefined
    const headers: Record<string, string> = {
      ...(bodyJSON ? { 'Content-Type': 'application/json' } : {}),
      ...(info.authToken ? { Authorization: `Bearer ${info.authToken}` } : {})
    }

    // Use the narrowed `useSocket` variable (string | false) to construct
    // request options so TypeScript knows socketPath is a string when truthy.
    const useSocket = !forceTcp && platformHasUnixSockets() && info.socketPath
    const reqOpts = useSocket
      ? { socketPath: useSocket, path, method, headers }
      : { hostname: '127.0.0.1', port: info.httpPort, path, method, headers }

    const req = httpRequest(reqOpts, (res: IncomingMessage) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        clearTimeout(timer)
        const raw = Buffer.concat(chunks).toString('utf-8')
        let data: unknown
        try {
          data = JSON.parse(raw)
        } catch {
          data = raw
        }
        resolve({ status: res.statusCode ?? 500, data })
      })
      res.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })

    const timer = setTimeout(() => {
      req.destroy(new Error(`RPC request timed out after ${RPC_TIMEOUT_MS / 1000}s`))
    }, RPC_TIMEOUT_MS)

    req.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    if (bodyJSON) req.write(bodyJSON)
    req.end()
  })
}

async function doRPC<T>(
  info: DiscoveryInfo,
  command: string,
  args: unknown,
  forceTcp = false
): Promise<T> {
  const { status, data } = await doRequest(info, '/rpc', 'POST', { command, args }, forceTcp)

  if (status === 401) {
    throw new UnauthorizedError(
      'Unauthorized: the auth token in the MCP discovery file may be stale'
    )
  }
  if (status >= 400) {
    const errData = data as { error?: string }
    throw new Error(errData.error ?? `RPC failed: HTTP ${status}`)
  }

  const body = data as { ok?: boolean; result?: T; error?: string }
  if (body.ok === false) throw new Error(body.error ?? 'RPC failed')
  return body.result as T
}

/** Error class to distinguish auth failures for retry logic. */
class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

function isSocketConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const code = 'code' in error ? String(error.code) : ''
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOENT' ||
    code === 'FailedToOpenSocket' ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('ENOENT')
  )
}

async function rpcWithFallback<T>(info: DiscoveryInfo, command: string, args: unknown): Promise<T> {
  try {
    return await doRPC<T>(info, command, args)
  } catch (error) {
    if (
      !platformHasUnixSockets() ||
      !info.socketPath ||
      info.httpPort <= 0 ||
      !isSocketConnectionError(error)
    ) {
      throw error
    }
    return doRPC<T>(info, command, args, true)
  }
}

export async function rpc<T = unknown>(command: string, args: unknown = {}): Promise<T> {
  try {
    return await rpcWithFallback<T>(await resolveDiscovery(), command, args)
  } catch (error) {
    if (!(error instanceof UnauthorizedError) && !isSocketConnectionError(error)) throw error
    cachedInfo = null
    return rpcWithFallback<T>(await resolveDiscovery(), command, args)
  }
}

export function isAppMode(file?: string): boolean {
  return !file
}

export function requireFile(file?: string): string {
  if (!file) throw new Error('File path is required for headless mode')
  return file
}
