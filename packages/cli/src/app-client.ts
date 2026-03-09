import { AUTOMATION_HTTP_PORT } from '@open-pencil/core'

const HEALTH_URL = `http://127.0.0.1:${AUTOMATION_HTTP_PORT}/health`
const RPC_URL = `http://127.0.0.1:${AUTOMATION_HTTP_PORT}/rpc`

let cachedToken: string | null = null

export async function getAppToken(): Promise<string> {
  if (cachedToken) return cachedToken
  const res = await fetch(HEALTH_URL).catch(() => null)
  if (!res || !res.ok) {
    throw new Error(
      `Could not connect to OpenPencil app on localhost:${AUTOMATION_HTTP_PORT}.\n` +
      'Is the app running? Start it with: bun run tauri dev'
    )
  }
  const data = (await res.json()) as { status: string; token?: string }
  if (data.status !== 'ok' || !data.token) {
    throw new Error(
      'OpenPencil app is running but no document is open.\n' +
      'Open a document in the app, or provide a .fig file path.'
    )
  }
  cachedToken = data.token
  return cachedToken
}

export async function rpc<T = unknown>(command: string, args: unknown = {}): Promise<T> {
  const token = await getAppToken()
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ command, args })
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as { error?: string; ok?: boolean }
    throw new Error(body.error ?? `RPC failed: HTTP ${res.status}`)
  }

  const body = (await res.json()) as { ok?: boolean; result?: T; error?: string }
  if (body.ok === false) throw new Error(body.error ?? 'RPC failed')
  return body.result as T
}

export function isAppMode(file?: string): boolean {
  return !file
}

export function requireFile(file?: string): string {
  if (!file) throw new Error('File path is required for headless mode')
  return file
}
