import { decodeTauriStderr } from '@/utils/tauri'
import { AUTOMATION_HTTP_PORT, IS_TAURI, randomHex } from '@open-pencil/core'

interface AutomationHealth {
  status: 'ok' | 'no_app'
  authRequired?: boolean
  token?: string
}

export interface AutomationServerHandle {
  disconnect: () => void
  authToken: string | null
}

const DEV_AUTOMATION_AUTH_TOKEN = import.meta.env.DEV ? __OPENPENCIL_LOCAL_AUTOMATION_TOKEN__ : null
const noop = () => undefined

let runtimeAutomationAuthToken: string | null = DEV_AUTOMATION_AUTH_TOKEN

async function readHealth(): Promise<AutomationHealth | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${AUTOMATION_HTTP_PORT}/health`, {
      signal: AbortSignal.timeout(1000)
    })
    if (!res.ok) return null
    return (await res.json()) as AutomationHealth
  } catch {
    return null
  }
}

async function pollHealth(retries: number, delayMs: number): Promise<AutomationHealth | null> {
  for (let i = 0; i < retries; i++) {
    await new Promise((r) => setTimeout(r, delayMs))
    const health = await readHealth()
    if (health) return health
  }
  return null
}

export async function getAutomationAuthToken(): Promise<string | null> {
  if (runtimeAutomationAuthToken) return runtimeAutomationAuthToken
  const health = await readHealth()
  runtimeAutomationAuthToken = health?.token ?? null
  return runtimeAutomationAuthToken
}

export async function spawnMCPIfNeeded(): Promise<AutomationServerHandle | null> {
  if (import.meta.env.DEV || !IS_TAURI) {
    return DEV_AUTOMATION_AUTH_TOKEN
      ? { disconnect: noop, authToken: DEV_AUTOMATION_AUTH_TOKEN }
      : null
  }

  const existing = await readHealth()
  if (existing) {
    runtimeAutomationAuthToken = existing.token ?? null
    return {
      disconnect: noop,
      authToken: runtimeAutomationAuthToken
    }
  }

  const authToken = randomHex(32)
  runtimeAutomationAuthToken = authToken

  const { Command } = await import('@tauri-apps/plugin-shell')
  const command = Command.create('openpencil-mcp', [], {
    env: {
      OPENPENCIL_MCP_AUTH_TOKEN: authToken,
      OPENPENCIL_MCP_CORS_ORIGIN: window.location.origin
    }
  })

  command.stderr.on('data', (raw: Uint8Array | number[] | string) => {
    console.error('[MCP]', decodeTauriStderr(raw))
  })

  command.on('close', (data: { code: number | null }) => {
    console.error(`[MCP] Server exited (code ${data.code ?? 'null'})`)
  })

  const child = await command.spawn()
  const health = await pollHealth(5, 1000)

  if (health) {
    runtimeAutomationAuthToken = health.token ?? authToken
    return {
      disconnect: () => {
        void child.kill()
      },
      authToken: runtimeAutomationAuthToken
    }
  }

  await child.kill()
  throw new Error(
    'Failed to start MCP server. Is openpencil-mcp installed? Run: npm i -g @open-pencil/mcp'
  )
}
