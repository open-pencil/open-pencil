import { APP_VERSION } from '@/app/runtime/version'

/**
 * The package and the entry point the desktop app starts.
 *
 * Kept here rather than in the spawner so Settings and setup can name them
 * without importing the spawning code.
 */
export const MCP_PACKAGE_NAME = '@lawha/mcp'
export const MCP_EXECUTABLE = 'lawha-mcp-http'

/** Exact package spec a user should install to match this app. */
export const MCP_INSTALL_TARGET = `${MCP_PACKAGE_NAME}@${APP_VERSION}`

/** Installs Lawha's MCP server at the version that matches the app. */
export const MCP_INSTALL_COMMAND = `npm i -g ${MCP_INSTALL_TARGET}`

/**
 * Why the local MCP server is unavailable.
 *
 * Codes stay in the domain so Settings can render translated, actionable copy.
 * Messages and stderr are diagnostic detail, never the user-facing heading.
 */
export type MCPFailureCode =
  | 'not-installed'
  | 'outdated'
  | 'permission-denied'
  | 'exited'
  | 'timeout'
  | 'rejected'
  | 'malformed'
  | 'unreachable'
  | 'unknown'

export interface MCPFailure {
  code: MCPFailureCode
  /**
   * Technical detail such as captured stderr or an HTTP status, or the running server's version
   * for `outdated`. Never translated.
   */
  detail?: string
}

/** Maximum diagnostic detail length retained for display. */
export const MCP_FAILURE_DETAIL_LIMIT = 400

/**
 * Reasons a restart fixes. A missing or outdated server is fixed by installing it, which restarts
 * it; a refused command needs the app reinstalled with its permissions.
 */
const RESTART_FIXES: ReadonlySet<MCPFailureCode> = new Set([
  'exited',
  'timeout',
  'rejected',
  'malformed',
  'unreachable',
  'unknown'
])

export function restartFixesMCPFailure(failure: MCPFailure): boolean {
  return RESTART_FIXES.has(failure.code)
}

export function mcpFailure(code: MCPFailureCode, detail?: string): MCPFailure {
  const trimmed = detail?.trim()
  return trimmed ? { code, detail: trimmed.slice(0, MCP_FAILURE_DETAIL_LIMIT) } : { code }
}

/** A startup error that already knows its reason code. */
export class MCPStartupError extends Error {
  constructor(
    message: string,
    readonly failure: MCPFailure
  ) {
    super(message)
    this.name = 'MCPStartupError'
  }
}

const PERMISSION_PATTERN = /not allowed|permission denied|forbidden|acl/i

/** Spawn failures only expose text, so the reason is derived once, in one place. */
export function classifySpawnFailure(error: unknown): MCPFailure {
  const message = error instanceof Error ? error.message : String(error)
  if (error instanceof MCPStartupError) return error.failure
  if (PERMISSION_PATTERN.test(message)) return mcpFailure('permission-denied', message)
  return mcpFailure('unknown', message)
}

export function failureFromError(error: unknown): MCPFailure {
  if (error instanceof MCPStartupError) return error.failure
  return classifySpawnFailure(error)
}
