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

/** Check whether the discovery file exists on disk. */
async function discoveryFileExists(discoveryPath: string): Promise<boolean> {
  try {
    const { exists } = await import('@tauri-apps/plugin-fs')
    return await exists(discoveryPath)
  } catch {
    return false
  }
}

/**
 * Computes the expected MCP discovery file path using the same platform
 * logic as the server's getDiscoveryPath(), but via Tauri APIs since we
 * run in the browser. This avoids trusting the unauthenticated /health
 * endpoint's discoveryPath field.
 */
async function computeExpectedDiscoveryPath(): Promise<string> {
  const { homeDir, join } = await import('@tauri-apps/api/path')
  const home = await homeDir()
  if (!home) throw new Error('homeDir() returned an empty string')

  const isMac = navigator.platform.includes('Mac')
  const isWindows = navigator.platform.includes('Win')
  // Must match the server's getPlatformDir() in packages/mcp/src/transport/paths.ts.
  // On Windows, LOCALAPPDATA usually equals <home>\AppData\Local, so this fallback
  // matches the server's path in the common case. When it doesn't (custom
  // LOCALAPPDATA), resolveDiscoveryPath() falls back to the /health endpoint.
  if (isMac) {
    return join(home, 'Library', 'Application Support', 'OpenPencil', 'mcp.json')
  }
  if (isWindows) {
    return join(home, 'AppData', 'Local', 'OpenPencil', 'mcp.json')
  }
  // Linux: $XDG_RUNTIME_DIR/openpencil/mcp.json or ~/.openpencil/mcp.json.
  // In Tauri we don't have direct env access, so we use the home-directory
  // fallback. The server may use XDG_RUNTIME_DIR if set — when the paths
  // differ, resolveDiscoveryPath() falls back to the /health endpoint.
  return join(home, '.openpencil', 'mcp.json')
}

/**
 * Resolves the discovery path to use for reading the auth token.
 *
 * Prefers the locally-computed path from `computeExpectedDiscoveryPath()` for
 * security. When the server-reported `healthDiscoveryPath` (from the
 * unauthenticated `/health` endpoint) differs, logs a warning and falls back
 * to the server-reported path as a compatibility measure.
 *
 * Security tradeoff: the `/health` endpoint is unauthenticated, so a
 * compromised server could redirect us to a malicious path. This is mitigated
 * by the fact that the server is on localhost and was spawned by us. The
 * fallback exists because local computation can be wrong (e.g., XDG_RUNTIME_DIR
 * mismatches on Linux where the server uses `$XDG_RUNTIME_DIR/openpencil` but
 * the local computation falls back to `~/.openpencil`).
 */
async function resolveDiscoveryPath(healthDiscoveryPath?: string): Promise<string> {
  const expected = await computeExpectedDiscoveryPath()
  if (healthDiscoveryPath && healthDiscoveryPath !== expected) {
    const localExists = await discoveryFileExists(expected)
    if (!localExists) {
      // Validate the server-reported path before accepting it. The /health
      // endpoint is unauthenticated, so we only accept paths within the
      // user's home directory ending in mcp.json.
      const { homeDir } = await import('@tauri-apps/api/path')
      const home = await homeDir()
      const sep = home.includes('\\') ? '\\' : '/'
      const hasTraversal = healthDiscoveryPath.split(/[\\/]/).some((segment) => segment === '..')
      const isSafe =
        healthDiscoveryPath.endsWith('mcp.json') &&
        !hasTraversal &&
        healthDiscoveryPath.startsWith(home + sep)
      if (isSafe) {
        console.warn(
          `[MCP] Server discovery path "${healthDiscoveryPath}" differs from expected "${expected}" ` +
            'and local path does not exist. Using server-reported path (server is on localhost).'
        )
        return healthDiscoveryPath
      }
    }
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
  if (!health) {
    throw new Error(
      'MCP server is not reachable. Ensure the desktop app is running and the MCP server has started.'
    )
  }
  assertCompatibleMcpVersion(health)
  const discoveryPath = await resolveDiscoveryPath(health.discoveryPath)
  const token = await readDiscoveryToken(discoveryPath)
  if (health.authRequired && !token) {
    throw new Error(
      'MCP server requires authentication but the discovery token could not be read. ' +
        'Ensure the discovery file is accessible and contains an auth token.'
    )
  }
  // When token is null and auth is not required, verify the discovery file
  // actually exists. A missing file means the server hasn't finished starting
  // (discovery file is written after listeners are up). Without this check,
  // we'd return null (meaning "auth disabled") when the server isn't ready
  // yet, causing ACP sessions to proceed without auth.
  if (!token && !health.authRequired) {
    const fileExists = await discoveryFileExists(discoveryPath)
    if (!fileExists) {
      throw new Error(
        `MCP server not yet ready — discovery file not found at ${discoveryPath}. ` +
          'Wait for the server to finish starting and try again.'
      )
    }
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
  // Cache only after MCP startup is confirmed healthy.

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

  let spawnedToken: string | null = null
  command.on('close', (data: { code: number | null }) => {
    console.error(`[MCP] Server exited (code ${data.code ?? 'null'})`)
    if (spawnedToken && runtimeAutomationAuthToken === spawnedToken) {
      runtimeAutomationAuthToken = null
    }
  })

  const child = await command.spawn()
  const health = await pollHealth(5, 1000)

  if (health) {
    try {
      assertCompatibleMcpVersion(health)
      const discoveryPath = await resolveDiscoveryPath(health.discoveryPath)
      const discovered = await readDiscoveryToken(discoveryPath)
      const token = discovered ?? authToken
      spawnedToken = token
      runtimeAutomationAuthToken = token
      return {
        disconnect: () => {
          void child.kill().catch((e) => {
            console.error('[MCP] Failed to kill server:', e)
          })
          if (runtimeAutomationAuthToken === token) {
            runtimeAutomationAuthToken = null
          }
        },
        authToken: token
      }
    } catch (err) {
      await child.kill().catch(() => undefined)
      runtimeAutomationAuthToken = null
      throw err
    }
  }

  try {
    await child.kill().catch(() => undefined)
  } finally {
    runtimeAutomationAuthToken = null
  }
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
