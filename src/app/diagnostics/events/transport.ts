import * as v from 'valibot'

import { recordDiagnostic } from '../recorder'
import type { DiagnosticEvent } from '../types'

const mcpFailureSchema = v.object({
  operation: v.picklist(['connect', 'request', 'disconnect']),
  errorName: v.string(),
  errorCode: v.nullable(v.string()),
  retryable: v.nullable(v.boolean())
})

const acpFailureSchema = v.object({
  operation: v.picklist(['start', 'message', 'stop']),
  errorName: v.string(),
  errorCode: v.nullable(v.string()),
  retryable: v.nullable(v.boolean())
})

export function recordMCPConnectionFailure(input: v.InferOutput<typeof mcpFailureSchema>): void {
  const parsed = v.safeParse(mcpFailureSchema, input)
  if (!parsed.success) return
  recordDiagnostic({
    category: 'mcp',
    level: 'error',
    name: 'mcp.connection.failed',
    attributes: parsed.output
  } satisfies Omit<DiagnosticEvent, 'id' | 'timestamp'>)
}

export function recordACPTransportFailure(input: v.InferOutput<typeof acpFailureSchema>): void {
  const parsed = v.safeParse(acpFailureSchema, input)
  if (!parsed.success) return
  recordDiagnostic({
    category: 'mcp',
    level: 'error',
    name: 'acp.transport.failed',
    attributes: parsed.output
  } satisfies Omit<DiagnosticEvent, 'id' | 'timestamp'>)
}
