import { promiseTimeout } from '@vueuse/core'

import { AUTOMATION_HTTP_PORT } from '@open-pencil/core/constants'
import { randomHex } from '@open-pencil/core/random'
import type { DiscoveryInfo } from '@open-pencil/mcp/discovery'

import { decodeTauriStderr } from '@/app/shell/ui'
import { isTauri } from '@/app/tauri/env'

interface AutomationHealth {
  status: 'ok' | 'no_app'
  version?: string
  installCommand?: string
  authRequired?: boolean
  discoveryPath?: string
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

/**
 * Reads the auth token from the MCP discovery file via Tauri's FS plugin.
 * The discovery file path comes from the /health endpoint (discoveryPath field),
 * which the server resolves using the same platform logic that writes the file.
 */
async function readDiscoveryToken(discoveryPath: string): Promise<string | null> {
  try {
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    const raw = await readTextFile(discoveryPath)
    const info = JSON.parse(raw) as DiscoveryInfo
    return info.authToken ?? null
  } catch {
    return null
  }
}

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

/**
 * Returns the major.minor portion of a semver string (e.g. "0.5.1" → "0.5").
 * Returns null if the string is not parseable as semver.
 */
function parseMajorMinor(version: string): string | null {
  const match = version.match(/^(\d+)\.(\d+)/)
  return match ? `${match[1]}.${match[2]}` : null
}

function assertCompatibleMcpVersion(health: AutomationHealth): void {
  const runningMajorMinor = health.version ? parseMajorMinor(health.version) : null
  const oursMajorMinor = parseMajorMinor(APP_VERSION)
  if (!runningMajorMinor || !oursMajorMinor) return // unparseable — don't block
  if (runningMajorMinor === oursMajorMinor) return
  const runningVersion = health.version ? `v${health.version}` : 'an older version'
  const updateHint = health.installCommand
    ? `Run: ${health.installCommand}, then restart OpenPencil.`
    : `Update the global @open-pencil/mcp package to v${APP_VERSION} with your package manager, then restart OpenPencil.`
  throw new Error(
    `OpenPencil desktop v${APP_VERSION} requires @open-pencil/mcp v${oursMajorMinor}.x ` +
      `(major.minor compatibility), but the running MCP server is ${runningVersion}. ${updateHint}`
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
  if (!health) return null
  assertCompatibleMcpVersion(health)
  if (!health.discoveryPath) return null
  const token = await readDiscoveryToken(health.discoveryPath)
  runtimeAutomationAuthToken = token
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
    const token = existing.discoveryPath ? await readDiscoveryToken(existing.discoveryPath) : null
    runtimeAutomationAuthToken = token
    return {
      disconnect: noop,
      authToken: runtimeAutomationAuthToken
    }
  }

  const authToken = randomHex(32)
  runtimeAutomationAuthToken = authToken

  const { Command } = await import('@tauri-apps/plugin-shell')
  const isWindows = navigator.platform.includes('Win')
  // Set OPENPENCIL_MCP_ROOT to the user's home directory so file-scoped
  // tools (open_file, save_file, export_*) operate on paths inside ~,
  // which is naturally writable and matches user expectations for "my files."
  // The app bundle directory (Tauri executableDir) is read-only and would
  // cause EACCES errors on every file write.
  const mcpRoot = await resolveTauriHomeDir()
  const command = isWindows
    ? Command.create('cmd', ['/c', 'openpencil-mcp-http'], {
        env: {
          OPENPENCIL_MCP_AUTH_TOKEN: authToken,
          OPENPENCIL_MCP_CORS_ORIGIN: window.location.origin,
          OPENPENCIL_MCP_TCP: '1',
          OPENPENCIL_MCP_ROOT: mcpRoot
        }
      })
    : Command.create('openpencil-mcp-http', [], {
        env: {
          OPENPENCIL_MCP_AUTH_TOKEN: authToken,
          OPENPENCIL_MCP_CORS_ORIGIN: window.location.origin,
          OPENPENCIL_MCP_TCP: '1',
          OPENPENCIL_MCP_ROOT: mcpRoot
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
    const discovered = health.discoveryPath ? await readDiscoveryToken(health.discoveryPath) : null
    runtimeAutomationAuthToken = discovered ?? authToken
    return {
      disconnect: () => {
        // Await the kill so the child process has actually exited before
        // the editor view is destroyed — otherwise the MCP server can outlive
        // its parent and the user sees ghost processes.
        void child.kill().catch((e) => {
          console.error('[MCP] Failed to kill server:', e)
        })
      },
      authToken: runtimeAutomationAuthToken
    }
  }

  await child.kill()
  throw new Error(
    `Failed to start MCP server. Install @open-pencil/mcp@${APP_VERSION} globally with your package manager, then restart OpenPencil.`
  )
}

/**
 * Returns the user's home directory. Used as the default OPENPENCIL_MCP_ROOT
 * so file-scoped tools operate on paths inside ~, which is writable and
 * matches user expectations. Falls back to process.cwd() if the Tauri
 * path plugin is unavailable (e.g. in a browser dev shell).
 */
async function resolveTauriHomeDir(): Promise<string> {
  try {
    const { homeDir } = await import('@tauri-apps/api/path')
    return await homeDir()
  } catch {
    return process.cwd()
  }
}
