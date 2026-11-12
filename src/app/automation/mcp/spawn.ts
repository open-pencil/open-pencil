import { invoke } from '@tauri-apps/api/core'
import { homeDir } from '@tauri-apps/api/path'
import { Command } from '@tauri-apps/plugin-shell'
import { promiseTimeout } from '@vueuse/core'
import { compact } from 'es-toolkit/array'

import { AUTOMATION_HTTP_PORT } from '@open-pencil/core/constants'
import { serializeDisabledTools } from '@open-pencil/mcp/tools'
import { randomHex } from '@open-pencil/scene-graph/random'

import { decodeTauriStderr } from '@/app/shell/ui'
import { canRunHostProcesses } from '@/app/tauri/capabilities'
import { resolvePlatformCommand } from '@/app/tauri/command'
import { isTauri } from '@/app/tauri/env'

import { DEV_MCP_RESTART_PATH, type DevMCPConfiguration } from './dev-control'
import {
  computeExpectedDiscoveryPath,
  discoveryFileExists,
  readDiscoveryToken,
  resolveDiscoveryPath
} from './discovery'
import {
  classifySpawnFailure,
  mcpFailure,
  MCP_EXECUTABLE,
  MCP_INSTALL_TARGET,
  MCPStartupError,
  type MCPFailure
} from './failure'
import {
  assertCompatibleMCPVersion,
  AUTOMATION_HTTP_URL,
  pollHealth,
  probeAutomationHealth,
  waitForHealth,
  type AutomationHealth
} from './health'
import {
  disabledMCPTools,
  mcpAuthenticationEnabled,
  mcpRootDirectory,
  mcpScope
} from './preferences'

export interface AutomationServerHandle {
  disconnect: () => void | Promise<void>
  authToken: string | null
  managed: boolean
}

export function getMCPServerURL(): string {
  return `${AUTOMATION_HTTP_URL}/mcp`
}

const DEV_AUTOMATION_AUTH_TOKEN =
  import.meta.env.DEV && typeof __OPENPENCIL_LOCAL_AUTOMATION_TOKEN__ === 'string'
    ? __OPENPENCIL_LOCAL_AUTOMATION_TOKEN__
    : null
const noop = () => undefined
const MAX_STARTUP_STDERR_LENGTH = 8_192

interface MCPLookup {
  available: boolean
  path: string | null
  searched: string[]
}
// While no app is attached, the spawned server waits this long for a register
// or reconnect before closing itself and removing its discovery file. This
// prevents a server that outlives a crashed/reloaded app from squatting the
// port forever while still allowing brief renderer reloads (issue #488).
const MCP_APP_ATTACH_TIMEOUT_MS = 30_000
// A server started from a cold npm shim can take longer than a few seconds to answer (14.8 s on
// a Windows VM, issue #1167). The app waits this long for it, leaving the rest of the attach
// grace above for the app to connect once it does.
const MCP_STARTUP_HEALTH_DEADLINE_MS = MCP_APP_ATTACH_TIMEOUT_MS - 10_000

/** Delays used while a spawned server comes up; tests shorten them. */
export interface MCPStartupTiming {
  /** How long to watch for the child exiting before polling its health. */
  earlyExitMs: number
  /** Delay before each of the health polls after spawning. */
  healthPollMs: number
  /** How long to keep polling while the child runs before giving up on it. */
  healthDeadlineMs?: number
}
const DEFAULT_STARTUP_TIMING: MCPStartupTiming = { earlyExitMs: 250, healthPollMs: 1000 }

let runtimeAutomationAuthToken: string | null = DEV_AUTOMATION_AUTH_TOKEN
let runtimeAutomationStartupError: Error | null = null
let runtimeAutomationStartupFailure: MCPFailure | null = null

/**
 * The startup failure recorded by the most recent spawn attempt. Settings uses
 * this so a missing install, a rejected shell command, or a server that exited
 * is reported instead of a single generic health message.
 */
export function getAutomationStartupError(): Error | null {
  return runtimeAutomationStartupError
}

export function getAutomationStartupFailure(): MCPFailure | null {
  return runtimeAutomationStartupFailure
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function missingMCPError(searched: string[] = []): Error {
  return new MCPStartupError(
    `MCP automation is not installed. Install ${MCP_INSTALL_TARGET} globally with your package manager, then restart OpenPencil.`,
    searched.length > 0
      ? mcpFailure('not-installed', searched.join(', '))
      : mcpFailure('not-installed')
  )
}

function rememberStartupError(error: unknown): null {
  runtimeAutomationStartupError = toError(error)
  runtimeAutomationStartupFailure = classifySpawnFailure(error)
  return null
}

export async function readAutomationHealth(
  authToken: string | null = runtimeAutomationAuthToken
): Promise<AutomationHealth | null> {
  return probeAutomationHealth(authToken)
}

/**
 * Checks that a running server is one this app can use and reads its auth token from the
 * discovery file, failing when the server requires a token the file does not hold.
 */
async function readRunningServerToken(
  health: AutomationHealth
): Promise<{ discoveryPath: string; token: string | null }> {
  assertCompatibleMCPVersion(health)
  const discoveryPath = await resolveDiscoveryPath(health.discoveryPath)
  const token = await readDiscoveryToken(discoveryPath)
  if (health.authRequired && !token) {
    throw new Error(
      'MCP server requires authentication but the discovery token could not be read. ' +
        'Ensure the discovery file is accessible and contains an auth token.'
    )
  }
  return { discoveryPath, token }
}

export async function getAutomationAuthToken(): Promise<string | null> {
  if (runtimeAutomationAuthToken) return runtimeAutomationAuthToken
  const health = await readAutomationHealth()
  if (!health) {
    if (runtimeAutomationStartupError) throw runtimeAutomationStartupError
    throw new Error(
      'MCP server is not reachable. Ensure the desktop app is running and the MCP server has started.'
    )
  }
  const { discoveryPath, token } = await readRunningServerToken(health)
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

async function readExistingServerHandle(): Promise<AutomationServerHandle | null> {
  const expectedDiscoveryPath = await computeExpectedDiscoveryPath()
  if (!(await discoveryFileExists(expectedDiscoveryPath))) return null

  const health = await readAutomationHealth()
  if (!health) return null
  const { token } = await readRunningServerToken(health)
  runtimeAutomationAuthToken = token
  return { disconnect: noop, authToken: token, managed: false }
}

async function configureDevMCP(): Promise<AutomationServerHandle> {
  if (!DEV_AUTOMATION_AUTH_TOKEN) throw new Error('MCP development control token is unavailable')
  const configuration: DevMCPConfiguration = {
    authenticationEnabled: mcpAuthenticationEnabled.value,
    rootDirectory: mcpRootDirectory.value,
    disabledTools: [...disabledMCPTools.value],
    scope: mcpScope()
  }
  const response = await fetch(DEV_MCP_RESTART_PATH, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DEV_AUTOMATION_AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(configuration)
  })
  if (!response.ok) {
    throw new MCPStartupError(
      `Failed to configure development MCP server (${response.status})`,
      mcpFailure('unknown', `HTTP ${response.status}`)
    )
  }
  const authToken = configuration.authenticationEnabled ? DEV_AUTOMATION_AUTH_TOKEN : null
  const health = await pollHealth(10, 250, authToken)
  if (!health)
    throw new MCPStartupError(
      'Development MCP server did not become healthy',
      mcpFailure('timeout', `${AUTOMATION_HTTP_URL}/health`)
    )
  runtimeAutomationAuthToken = authToken
  return { disconnect: noop, authToken, managed: true }
}

function exitedStartupError(
  message: string,
  event: { code: number | null; signal: number | null },
  stderr: string
): MCPStartupError {
  const details = stderr.trim()
  return new MCPStartupError(
    `${message} (code ${event.code ?? 'null'}, signal ${event.signal ?? 'null'})${details ? `: ${details}` : '.'}`,
    mcpFailure(
      'exited',
      compact([`code=${event.code ?? 'null'}`, `signal=${event.signal ?? 'null'}`, details]).join(
        ' '
      )
    )
  )
}

async function startMCPIfNeeded(timing: MCPStartupTiming): Promise<AutomationServerHandle | null> {
  runtimeAutomationStartupError = null
  runtimeAutomationStartupFailure = null
  if (import.meta.env.DEV) return configureDevMCP()
  if (!isTauri()) return null

  const existing = await readExistingServerHandle()
  if (existing) {
    return existing
  }
  // A sandboxed package cannot start the server; one the user runs is still found by
  // its health check, as in the browser.
  if (!canRunHostProcesses()) return null
  return launchMCPServer(timing)
}

async function launchMCPServer(timing: MCPStartupTiming): Promise<AutomationServerHandle | null> {
  const lookup = await invoke<MCPLookup>('mcp_lookup')
  if (!lookup.available) return rememberStartupError(missingMCPError(lookup.searched))

  const authToken = mcpAuthenticationEnabled.value ? randomHex(32) : null
  // Cache only after MCP startup is confirmed healthy.

  // Scope file tools to the configured root, defaulting to the user's home.
  // The app bundle directory (Tauri executableDir) is read-only and cannot be
  // used as a safe fallback for open_document, save_document, or export tools.
  const mcpRoot = mcpRootDirectory.value.trim() || (await resolveTauriHomeDir())
  const resolved = resolvePlatformCommand(MCP_EXECUTABLE)
  const command = Command.create(resolved.command, resolved.args, {
    env: {
      PORT: String(AUTOMATION_HTTP_PORT),
      OPENPENCIL_MCP_AUTH_TOKEN: authToken ?? '',
      OPENPENCIL_MCP_CORS_ORIGIN: window.location.origin,
      OPENPENCIL_MCP_TCP: '1',
      OPENPENCIL_MCP_ROOT: mcpRoot,
      OPENPENCIL_MCP_APP_TIMEOUT_MS: String(MCP_APP_ATTACH_TIMEOUT_MS),
      // Killing the shell wrapper on Windows leaves the server it started running; the app's end
      // of the pipe closes with it, and the server exits on that.
      OPENPENCIL_MCP_EXIT_ON_STDIN_CLOSE: '1',
      OPENPENCIL_MCP_DISABLED_TOOLS: serializeDisabledTools(disabledMCPTools.value),
      OPENPENCIL_MCP_SCOPE: mcpScope()
    }
  })

  let startupStderr = ''
  command.stderr.on('data', (raw: Uint8Array | number[] | string) => {
    if (startupStderr.length >= MAX_STARTUP_STDERR_LENGTH) return
    startupStderr += decodeTauriStderr(raw).slice(
      0,
      MAX_STARTUP_STDERR_LENGTH - startupStderr.length
    )
  })

  let spawnedToken: string | null = null
  let child: Awaited<ReturnType<typeof command.spawn>>
  const childClosed = new Promise<{ code: number | null; signal: number | null }>((resolve) => {
    command.on('close', (event) => {
      resolve(event)
      if (spawnedToken && runtimeAutomationAuthToken === spawnedToken) {
        runtimeAutomationAuthToken = null
      }
    })
  })

  try {
    child = await command.spawn()
  } catch (error) {
    return rememberStartupError(error)
  }
  const earlyExit = await Promise.race([
    childClosed,
    promiseTimeout(timing.earlyExitMs).then(() => null)
  ])
  if (earlyExit) {
    return rememberStartupError(
      exitedStartupError('MCP server exited before startup completed', earlyExit, startupStderr)
    )
  }
  const health = await waitForHealth(
    timing.healthDeadlineMs ?? MCP_STARTUP_HEALTH_DEADLINE_MS,
    timing.healthPollMs,
    authToken,
    childClosed
  )

  if (health) {
    try {
      assertCompatibleMCPVersion(health)
      const discoveryPath = await resolveDiscoveryPath(health.discoveryPath)
      const discovered = await readDiscoveryToken(discoveryPath)
      const token = health.authRequired ? (discovered ?? authToken) : null
      spawnedToken = token
      runtimeAutomationAuthToken = token
      runtimeAutomationStartupError = null
      runtimeAutomationStartupFailure = null
      return {
        disconnect: async () => {
          await child.kill().catch((e) => {
            console.error('[MCP] Failed to kill server:', e)
          })
          if (runtimeAutomationAuthToken === token) {
            runtimeAutomationAuthToken = null
          }
        },
        authToken: token,
        managed: true
      }
    } catch (err) {
      await child.kill().catch(() => undefined)
      runtimeAutomationAuthToken = null
      throw err
    }
  }

  // A child that exited while the app waited for it is a crash, not a slow start.
  const exitedWhileWaiting = await Promise.race([childClosed, Promise.resolve(null)])
  try {
    await child.kill().catch(() => undefined)
  } finally {
    runtimeAutomationAuthToken = null
  }
  if (exitedWhileWaiting) {
    return rememberStartupError(
      exitedStartupError('MCP server exited before it answered', exitedWhileWaiting, startupStderr)
    )
  }
  return rememberStartupError(
    new MCPStartupError(
      `MCP server did not become healthy within the startup timeout${startupStderr.trim() ? `: ${startupStderr.trim()}` : '.'}`,
      mcpFailure('timeout', startupStderr)
    )
  )
}

export async function spawnMCPIfNeeded(
  timing: MCPStartupTiming = DEFAULT_STARTUP_TIMING
): Promise<AutomationServerHandle | null> {
  try {
    return await startMCPIfNeeded(timing)
  } catch (error) {
    return rememberStartupError(error)
  }
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
