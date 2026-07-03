import { request as httpRequest } from 'node:http'
import type { IncomingMessage } from 'node:http'

import { readDiscoveryFile } from '@open-pencil/mcp/discovery'
import type { DiscoveryInfo } from '@open-pencil/mcp/discovery'
import { platformHasUnixSockets } from '@open-pencil/mcp/transport'

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

    const useSocket = platformHasUnixSockets() && info.socketPath
    const reqOpts = useSocket
      ? { socketPath: info.socketPath, path, method, headers }
      : { hostname: '127.0.0.1', port: info.httpPort, path, method, headers }

    const req = httpRequest(reqOpts, (res: IncomingMessage) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8')
        let data: unknown
        try {
          data = JSON.parse(raw)
        } catch {
          data = raw
        }
        resolve({ status: res.statusCode ?? 200, data })
      })
      res.on('error', reject)
    })

    req.on('error', reject)
    if (bodyJson) req.write(bodyJson)
    req.end()
  })
}

async function doRpc<T>(info: DiscoveryInfo, command: string, args: unknown): Promise<T> {
  const { status, data } = await doRequest(info, '/rpc', 'POST', { command, args })

  if (status === 401) {
    throw new Error('Unauthorized: check OPENPENCIL_MCP_AUTH_TOKEN')
  }
  if (status >= 400) {
    const errData = data as { error?: string }
    throw new Error(errData.error ?? `RPC failed: HTTP ${status}`)
  }

  const body = data as { ok?: boolean; result?: T; error?: string }
  if (body.ok === false) throw new Error(body.error ?? 'RPC failed')
  return body.result as T
}

export async function rpc<T = unknown>(command: string, args: unknown = {}): Promise<T> {
  const info = await resolveDiscovery()

  try {
    return await doRpc<T>(info, command, args)
  } catch {
    // One retry: the server may have restarted with new discovery info
    // (different socket path, port, or auth token). Re-read the file
    // and try again. If it fails a second time the error propagates.
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
