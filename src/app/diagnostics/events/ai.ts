import * as v from 'valibot'

import { recordDiagnostic } from '../recorder'
import { isUsageEnabled } from '../settings'
import type { DiagnosticEvent, DiagnosticValue } from '../types'

const modelStepSchema = v.object({
  provider: v.string(),
  model: v.string(),
  inputTokens: v.nullable(v.number()),
  outputTokens: v.nullable(v.number()),
  cacheReadTokens: v.nullable(v.number()),
  cacheWriteTokens: v.nullable(v.number())
})

const chatCompletedSchema = v.object({ finishReason: v.nullable(v.string()) })
const chatFailedSchema = v.object({ errorName: v.string() })
const toolCompletedSchema = v.object({
  tool: v.string(),
  durationMs: v.number(),
  mutates: v.boolean(),
  failed: v.boolean()
})

export type AIDiagnosticContext = Pick<DiagnosticEvent, 'sessionId' | 'runId'>

function recordAIEvent(
  name: 'model.step.completed' | 'chat.completed' | 'chat.failed' | 'tool.completed',
  attributes: Record<string, DiagnosticValue>,
  schema: v.GenericSchema,
  context: AIDiagnosticContext = {}
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
    level: name === 'chat.failed' ? 'error' : 'info',
    name,
    attributes: output
  } satisfies Omit<DiagnosticEvent, 'id' | 'timestamp'>)
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

export function recordToolCompleted(
  input: v.InferOutput<typeof toolCompletedSchema>,
  context?: AIDiagnosticContext
): void {
  recordAIEvent('tool.completed', input, toolCompletedSchema, context)
}
