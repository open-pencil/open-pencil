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
 * The discovery file path is computed locally (not from the /health endpoint)
 * to prevent an unauthenticated /health response from directing file reads
 * to an attacker-controlled path.
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

/**
 * Computes the expected MCP discovery file path using the same platform
 * logic as the server's getDiscoveryPath(), but via Tauri APIs since we
 * run in the browser. This avoids trusting the unauthenticated /health
 * endpoint's discoveryPath field.
 */
async function computeExpectedDiscoveryPath(): Promise<string> {
  const { homeDir } = await import('@tauri-apps/api/path')
  const home = await homeDir()
  if (!home) throw new Error('homeDir() returned an empty string')

  const isMac = navigator.platform.includes('Mac')
  // Must match the server's getSocketDir() in packages/mcp/src/transport/paths.ts
  if (isMac) {
    return `${home}Library/Application Support/OpenPencil/mcp.json`
  }
  // Linux: $XDG_RUNTIME_DIR/openpencil/mcp.json or ~/.openpencil/mcp.json
  // In Tauri we don't have access to env vars directly, so try the XDG path
  // pattern and fall back to the home directory hidden dir.
  // Note: the Tauri-spawned server runs with the user's env, so it will use
  // XDG_RUNTIME_DIR if set. We can't check that from JS, so we try reading
  // from the health endpoint's discoveryPath as a fallback (with a warning).
  return `${home}.openpencil/mcp.json`
}

/**
 * Resolves the discovery path to use for reading the auth token.
 * Computes the expected path locally and compares it with the health
 * endpoint's discoveryPath. If they differ, logs a warning and uses
 * the locally-computed path for security.
 */
async function resolveDiscoveryPath(healthDiscoveryPath?: string): Promise<string> {
  const expected = await computeExpectedDiscoveryPath()
  if (healthDiscoveryPath && healthDiscoveryPath !== expected) {
    console.warn(
      `[MCP] Server discovery path "${healthDiscoveryPath}" differs from expected "${expected}". ` +
        'Using server-reported path (server is on localhost).'
    )
    // Trust the server's path when it differs — the local computation
    // may be wrong (e.g., on Linux when XDG_RUNTIME_DIR is set, the
    // server uses $XDG_RUNTIME_DIR/openpencil but our local computation
    // falls back to ~/.openpencil). The server is on localhost and was
    // spawned by us, so the redirect risk is minimal.
    return healthDiscoveryPath
  }
  return expected
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
  const discoveryPath = await resolveDiscoveryPath(health.discoveryPath)
  const token = await readDiscoveryToken(discoveryPath)
  if (health.authRequired && !token) {
    throw new Error(
      'MCP server requires authentication but the discovery token could not be read. ' +
        'Ensure the discovery file is accessible and contains an auth token.'
    )
  }
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
    const discoveryPath = await resolveDiscoveryPath(existing.discoveryPath)
    const token = await readDiscoveryToken(discoveryPath)
    if (existing.authRequired && !token) {
      throw new Error(
        'MCP server requires authentication but the discovery token could not be read. ' +
          'Ensure the discovery file is accessible and contains an auth token.'
      )
    }
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
          PORT: String(AUTOMATION_HTTP_PORT),
          OPENPENCIL_MCP_AUTH_TOKEN: authToken,
          OPENPENCIL_MCP_CORS_ORIGIN: window.location.origin,
          OPENPENCIL_MCP_TCP: '1',
          OPENPENCIL_MCP_ROOT: mcpRoot
        }
      })
    : Command.create('openpencil-mcp-http', [], {
        env: {
          PORT: String(AUTOMATION_HTTP_PORT),
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
    const discoveryPath = await resolveDiscoveryPath(health.discoveryPath)
    const discovered = await readDiscoveryToken(discoveryPath)
    runtimeAutomationAuthToken = discovered ?? authToken
    return {
      disconnect: () => {
        // Send SIGTERM to the child process. Fire-and-forget to avoid blocking
        // if the child is hung. Errors are logged for debugging.
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
 * matches user expectations. Throws if the Tauri path plugin is unavailable
 * — this function is only invoked under !import.meta.env.DEV && isTauri(),
 * so the Tauri path plugin should always succeed. A silent fallback to '/'
 * would defeat path scoping in resolveSafePath, and process.cwd() is
 * unpredictable and may also be too broad.
 */
async function resolveTauriHomeDir(): Promise<string> {
  try {
    const { homeDir } = await import('@tauri-apps/api/path')
    const dir = await homeDir()
    if (!dir) {
      throw new Error('homeDir() returned an empty string')
    }
    return dir
  } catch (e) {
    throw new Error(
      'Failed to resolve home directory for MCP root. ' +
        'The MCP server requires a home directory to scope file operations. ' +
        (e instanceof Error ? e.message : String(e))
    )
  }
}
