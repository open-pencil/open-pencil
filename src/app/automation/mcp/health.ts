import { promiseTimeout } from '@vueuse/core'

import { AUTOMATION_HTTP_PORT } from '@open-pencil/core/constants'
import { parseToolDescriptor, type ToolDescriptor } from '@open-pencil/mcp/tools'

import { APP_VERSION } from '@/app/runtime/version'

import {
  mcpFailure,
  MCP_INSTALL_COMMAND,
  MCP_PACKAGE_NAME,
  MCPStartupError,
  type MCPFailure
} from './failure'

export interface AutomationHealth {
  status: 'ok' | 'no_app'
  version?: string
  authRequired?: boolean
  discoveryPath?: string
  tools?: ToolDescriptor[]
  /** The server tells the app when an agent opens a session, so a chat can wait for its agent. */
  agentSessionEvents?: boolean
}

/** The automation server's HTTP origin: the development server's in development. */
export const AUTOMATION_HTTP_URL = import.meta.env.DEV
  ? __OPENPENCIL_LOCAL_AUTOMATION_HTTP_URL__
  : `http://127.0.0.1:${AUTOMATION_HTTP_PORT}`

let healthFailure: MCPFailure | null = null

/** Why the most recent health probe failed. */
export function getAutomationHealthFailure(): MCPFailure | null {
  return healthFailure
}

interface AutomationHealthRecord {
  status?: unknown
  version?: unknown
  installCommand?: unknown
  authRequired?: unknown
  discoveryPath?: unknown
  tools?: unknown
  agentSessionEvents?: unknown
}

function isAutomationHealthRecord(value: unknown): value is AutomationHealthRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  return typeof value === 'string' ? value : null
}

function optionalBoolean(value: unknown): boolean | null | undefined {
  if (value === undefined) return undefined
  return typeof value === 'boolean' ? value : null
}

function parseToolDescriptors(value: unknown): ToolDescriptor[] | null | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return null
  const descriptors: ToolDescriptor[] = []
  for (const candidate of value) {
    const descriptor = parseToolDescriptor(candidate)
    if (!descriptor) return null
    descriptors.push(descriptor)
  }
  return descriptors
}

function parseAutomationHealth(value: unknown): AutomationHealth | null {
  if (!isAutomationHealthRecord(value)) return null
  if (value.status !== 'ok' && value.status !== 'no_app') return null
  const version = optionalString(value.version)
  const authRequired = optionalBoolean(value.authRequired)
  const discoveryPath = optionalString(value.discoveryPath)
  const tools = parseToolDescriptors(value.tools)
  const agentSessionEvents = optionalBoolean(value.agentSessionEvents)
  if (
    version === null ||
    authRequired === null ||
    discoveryPath === null ||
    tools === null ||
    agentSessionEvents === null
  ) {
    return null
  }
  const health: AutomationHealth = { status: value.status }
  if (version !== undefined) health.version = version
  if (authRequired !== undefined) health.authRequired = authRequired
  if (discoveryPath !== undefined) health.discoveryPath = discoveryPath
  if (tools !== undefined) health.tools = tools
  if (agentSessionEvents !== undefined) health.agentSessionEvents = agentSessionEvents
  return health
}

/**
 * Asks the server at `AUTOMATION_HTTP_URL` for its health with `authToken`, recording why the probe
 * failed for `getAutomationHealthFailure()`.
 */
export async function probeAutomationHealth(
  authToken: string | null
): Promise<AutomationHealth | null> {
  try {
    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined
    const res = await fetch(`${AUTOMATION_HTTP_URL}/health`, {
      headers,
      signal: AbortSignal.timeout(1000)
    })
    if (!res.ok) {
      // A running server that refuses our token needs a new token; any other
      // status means we are not talking to the server we expect.
      const rejectsCredentials = res.status === 401 || res.status === 403
      healthFailure = rejectsCredentials
        ? mcpFailure('rejected', `HTTP ${res.status}`)
        : mcpFailure('malformed', `HTTP ${res.status}`)
      return null
    }
    const health = parseAutomationHealth(await res.json())
    if (!health) {
      healthFailure = mcpFailure('malformed', `HTTP ${res.status}`)
      return null
    }
    healthFailure = null
    return health
  } catch {
    healthFailure = mcpFailure('unreachable', AUTOMATION_HTTP_URL)
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

export function assertCompatibleMCPVersion(health: AutomationHealth): void {
  const runningMajorMinor = health.version ? parseMajorMinor(health.version) : null
  const oursMajorMinor = parseMajorMinor(APP_VERSION)
  if (!oursMajorMinor) return
  if (runningMajorMinor === oursMajorMinor) return
  const runningVersion = health.version ? `v${health.version}` : 'an older version'
  // The running server's own install command names its own version, so the fix always
  // comes from this app's version.
  throw new MCPStartupError(
    `OpenPencil desktop v${APP_VERSION} requires ${MCP_PACKAGE_NAME} v${oursMajorMinor}.x ` +
      `(major.minor compatibility), but the running MCP server is ${runningVersion}. ` +
      `Run: ${MCP_INSTALL_COMMAND}, then restart the MCP server.`,
    mcpFailure('outdated', health.version)
  )
}

/** Probes health `attempts` times, `delayMs` apart, until the server answers. */
export async function pollHealth(
  attempts: number,
  delayMs: number,
  authToken: string | null
): Promise<AutomationHealth | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    await promiseTimeout(delayMs)
    const health = await probeAutomationHealth(authToken)
    if (health) return health
  }
  return null
}

/**
 * Polls a server the app just started for as long as it runs, up to a deadline, so a slow start
 * is not mistaken for a failed one. Resolves to null when the deadline passes or the child exits.
 */
export async function waitForHealth(
  deadlineMs: number,
  delayMs: number,
  authToken: string | null,
  childClosed: Promise<unknown>
): Promise<AutomationHealth | null> {
  const exited = childClosed.then(() => 'exited' as const)
  const giveUpAt = Date.now() + deadlineMs
  const deadline = promiseTimeout(deadlineMs).then(() => 'deadline' as const)
  for (;;) {
    const remainingMs = giveUpAt - Date.now()
    if (remainingMs <= 0) return null
    const woke = await Promise.race([
      promiseTimeout(Math.min(delayMs, remainingMs)).then(() => 'waited' as const),
      deadline,
      exited
    ])
    if (woke !== 'waited') return null
    // A probe still running at the deadline does not count.
    const health = await Promise.race([probeAutomationHealth(authToken), deadline, exited])
    // An answer from a server whose process already ended does not count.
    if (health === 'deadline' || health === 'exited') return null
    if (health) return health
  }
}
