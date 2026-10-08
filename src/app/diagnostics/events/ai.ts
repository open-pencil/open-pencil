import { pick } from 'es-toolkit'
import * as v from 'valibot'

import { describeDiagnosticError, diagnosticErrorDetails, isInternalError } from '../error'
import { recordDiagnostic } from '../recorder'
import { isUsageEnabled } from '../settings'
import type {
  DiagnosticEvent,
  DiagnosticEventInput,
  DiagnosticLevel,
  DiagnosticValue
} from '../types'

const modelStepSchema = v.object({
  provider: v.string(),
  model: v.string(),
  inputTokens: v.nullable(v.number()),
  outputTokens: v.nullable(v.number()),
  cacheReadTokens: v.nullable(v.number()),
  cacheWriteTokens: v.nullable(v.number())
})

const chatCompletedSchema = v.object({ finishReason: v.nullable(v.string()) })
const chatFailedSchema = v.object({
  errorName: v.string(),
  errorCode: v.optional(v.nullable(v.string())),
  message: v.optional(v.nullable(v.string())),
  stack: v.optional(v.nullable(v.string()))
})
const toolCompletedSchema = v.object({
  tool: v.string(),
  durationMs: v.number(),
  mutates: v.boolean(),
  failed: v.boolean(),
  errorName: v.optional(v.string()),
  message: v.optional(v.nullable(v.string())),
  stack: v.optional(v.nullable(v.string()))
})

export type AIDiagnosticContext = Pick<DiagnosticEvent, 'sessionId' | 'runId'>

function recordAIEvent(
  name: 'model.step.completed' | 'chat.completed' | 'chat.failed' | 'tool.completed',
  attributes: Record<string, DiagnosticValue>,
  schema: v.GenericSchema,
  context: AIDiagnosticContext = {},
  level: DiagnosticLevel = name === 'chat.failed' ? 'error' : 'info'
): void {
  const parsed = v.safeParse(schema, attributes)
  if (!parsed.success) {
    console.warn(`[Diagnostics] Invalid AI event: ${name}`)
    return
  }
  if (name === 'model.step.completed' && !isUsageEnabled()) return
  const output = parsed.output as Record<string, DiagnosticValue>
  recordDiagnostic({
    ...context,
    category: 'ai',
    level,
    name,
    attributes: output
  } satisfies DiagnosticEventInput)
}

export function recordModelStepCompleted(
  input: v.InferOutput<typeof modelStepSchema>,
  context?: AIDiagnosticContext
): void {
  recordAIEvent('model.step.completed', input, modelStepSchema, context)
}

export function recordChatCompleted(
  input: v.InferOutput<typeof chatCompletedSchema>,
  context?: AIDiagnosticContext
): void {
  recordAIEvent('chat.completed', input, chatCompletedSchema, context)
}

export function recordChatFailed(
  input: v.InferOutput<typeof chatFailedSchema>,
  context?: AIDiagnosticContext
): void {
  recordAIEvent('chat.failed', input, chatFailedSchema, context)
}

type ToolOutcome = { level: DiagnosticLevel; details: Record<string, DiagnosticValue> }

/**
 * A failed call is a warning, since models often call a tool wrongly, and keeps only the
 * error's name: its message quotes the call's input. A bug in OpenPencil is an error and
 * keeps its message and stack, which name code rather than content.
 */
function toolOutcome(failed: boolean, cause: unknown): ToolOutcome {
  if (!failed) return { level: 'info', details: {} }
  if (isInternalError(cause)) {
    return {
      level: 'error',
      details: pick(diagnosticErrorDetails(cause), ['errorName', 'message', 'stack'])
    }
  }
  // A tool that returned `{ error }` threw nothing.
  const details = cause === undefined ? {} : pick(describeDiagnosticError(cause), ['errorName'])
  return { level: 'warning', details }
}

export function recordToolCompleted(
  input: Omit<v.InferOutput<typeof toolCompletedSchema>, 'errorName' | 'message' | 'stack'>,
  context?: AIDiagnosticContext,
  cause?: unknown
): void {
  const { level, details } = toolOutcome(input.failed, cause)
  recordAIEvent('tool.completed', { ...input, ...details }, toolCompletedSchema, context, level)
}
