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

  let info: DiscoveryInfo | null = null
  try {
    info = await readDiscoveryFile()
  } catch (e) {
    if (e instanceof Error && 'code' in e && (e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`Failed to read discovery file: ${e.message}`)
    }
  }

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
  body?: Record<string, unknown>
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const bodyJson = body ? JSON.stringify(body) : undefined
    const headers: Record<string, string> = {
      ...(bodyJson ? { 'Content-Type': 'application/json' } : {}),
      ...(info.authToken ? { Authorization: `Bearer ${info.authToken}` } : {})
    }

    // Use the narrowed `useSocket` variable (string | false) to construct
    // request options so TypeScript knows socketPath is a string when truthy.
    const useSocket = platformHasUnixSockets() && info.socketPath
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
        resolve({ status: res.statusCode ?? 200, data })
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
    if (bodyJson) req.write(bodyJson)
    req.end()
  })
}

async function doRpc<T>(info: DiscoveryInfo, command: string, args: unknown): Promise<T> {
  const { status, data } = await doRequest(info, '/rpc', 'POST', { command, args })

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

function isTransientError(err: unknown): boolean {
  if (err instanceof UnauthorizedError) return true
  if (err instanceof Error) {
    const msg = err.message
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOENT')) return true
    if (msg.includes('timed out')) return true
    if (msg.includes('socket hang up')) return true
  }
  return false
}

export async function rpc<T = unknown>(command: string, args: unknown = {}): Promise<T> {
  const info = await resolveDiscovery()

  try {
    return await doRpc<T>(info, command, args)
  } catch (err) {
    // Only retry on transient errors (auth token rotation, connection refused,
    // timeout). Application-level errors (bad command, 502, ok:false) are
    // re-thrown immediately — retrying would just waste a round-trip.
    if (!isTransientError(err)) throw err
    cachedInfo = null
    return doRpc<T>(await resolveDiscovery(), command, args)
  }
}

export function isAppMode(file?: string): boolean {
  return !file
}

export function requireFile(file?: string): string {
  if (!file) throw new Error('File path is required for headless mode')
  return file
}
