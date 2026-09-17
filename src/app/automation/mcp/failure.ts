/**
 * Why the local MCP server is unavailable.
 *
 * Codes stay in the domain so Settings can render translated, actionable copy.
 * Messages and stderr are diagnostic detail, never the user-facing heading.
 */
export type MCPFailureCode =
  | 'not-installed'
  | 'permission-denied'
  | 'exited'
  | 'timeout'
  | 'rejected'
  | 'malformed'
  | 'unreachable'
  | 'unknown'

export interface MCPFailure {
  code: MCPFailureCode
  /** Technical detail such as captured stderr or an HTTP status. Never translated. */
  detail?: string
}

/** Maximum diagnostic detail length retained for display. */
export const MCP_FAILURE_DETAIL_LIMIT = 400

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
