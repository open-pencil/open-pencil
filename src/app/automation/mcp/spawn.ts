import { promiseTimeout } from '@vueuse/core'

import { AUTOMATION_HTTP_PORT } from '@open-pencil/core/constants'
import { randomHex } from '@open-pencil/core/random'

import { decodeTauriStderr } from '@/app/shell/ui'
import { resolvePlatformCommand } from '@/app/tauri/command'
import { isTauri } from '@/app/tauri/env'

interface AutomationHealth {
  status: 'ok' | 'no_app'
  version?: string
  installCommand?: string
  authRequired?: boolean
  token?: string
}

export interface AutomationServerHandle {
  disconnect: () => void
  authToken: string | null
}

const DEV_AUTOMATION_AUTH_TOKEN =
  import.meta.env.DEV && typeof __OPENPENCIL_LOCAL_AUTOMATION_TOKEN__ === 'string'
    ? __OPENPENCIL_LOCAL_AUTOMATION_TOKEN__
    : null
const APP_VERSION =
  typeof __OPENPENCIL_APP_VERSION__ === 'string' ? __OPENPENCIL_APP_VERSION__ : '0.0.0-test'
const noop = () => undefined

let runtimeAutomationAuthToken: string | null = DEV_AUTOMATION_AUTH_TOKEN

async function readHealth(): Promise<AutomationHealth | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${AUTOMATION_HTTP_PORT}/health`, {
      signal: AbortSignal.timeout(1000)
    })
    if (!res.ok) return null
    return (await res.json()) as AutomationHealth
  } catch (e) {
    console.error('[MCP] health check failed:', e instanceof Error ? e.message : e)
    return null
  }
}

function assertCompatibleMcpVersion(health: AutomationHealth): void {
  if (health.version === APP_VERSION) return
  const runningVersion = health.version ? `v${health.version}` : 'an older version'
  const updateHint = health.installCommand
    ? `Run: ${health.installCommand}, then restart OpenPencil.`
    : `Update the global @open-pencil/mcp package to v${APP_VERSION} with your package manager, then restart OpenPencil.`
  throw new Error(
    `OpenPencil desktop v${APP_VERSION} requires @open-pencil/mcp v${APP_VERSION}, ` +
      `but the running MCP server is ${runningVersion}. ${updateHint}`
  )
}

async function pollHealth(retries: number, delayMs: number): Promise<AutomationHealth | null> {
  for (let i = 0; i < retries; i++) {
    await promiseTimeout(delayMs)
    const health = await readHealth()
    if (health) return health
  }
  return null
}

export async function getAutomationAuthToken(): Promise<string | null> {
  if (runtimeAutomationAuthToken) return runtimeAutomationAuthToken
  const health = await readHealth()
  if (health) assertCompatibleMcpVersion(health)
  runtimeAutomationAuthToken = health?.token ?? null
  return runtimeAutomationAuthToken
}

export async function spawnMCPIfNeeded(): Promise<AutomationServerHandle | null> {
  if (import.meta.env.DEV || !isTauri()) {
    return DEV_AUTOMATION_AUTH_TOKEN
      ? { disconnect: noop, authToken: DEV_AUTOMATION_AUTH_TOKEN }
      : null
  }

  const existing = await readHealth()
  if (existing) {
    assertCompatibleMcpVersion(existing)
    runtimeAutomationAuthToken = existing.token ?? null
    return {
      disconnect: noop,
      authToken: runtimeAutomationAuthToken
    }
  }

  const authToken = randomHex(32)
  runtimeAutomationAuthToken = authToken

  const { Command } = await import('@tauri-apps/plugin-shell')
  const resolved = resolvePlatformCommand('openpencil-mcp-http')
  const command = Command.create(resolved.command, resolved.args, {
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
    assertCompatibleMcpVersion(health)
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
    `Failed to start MCP server. Install @open-pencil/mcp@${APP_VERSION} globally with your package manager, then restart OpenPencil.`
  )
}
