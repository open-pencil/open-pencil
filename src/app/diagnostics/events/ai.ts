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

function recordAIEvent(
  name: 'model.step.completed' | 'chat.completed' | 'chat.failed',
  attributes: Record<string, DiagnosticValue>,
  schema: v.GenericSchema
): void {
  const parsed = v.safeParse(schema, attributes)
  if (!parsed.success) {
    console.warn(`[Diagnostics] Invalid AI event: ${name}`)
    return
  }
  if (name === 'model.step.completed' && !isUsageEnabled()) return
  const output = parsed.output as Record<string, DiagnosticValue>
  recordDiagnostic({
    category: 'ai',
    level: name === 'chat.failed' ? 'error' : 'info',
    name,
    attributes: output
  } satisfies Omit<DiagnosticEvent, 'id' | 'timestamp'>)
}

export function recordModelStepCompleted(input: v.InferOutput<typeof modelStepSchema>): void {
  recordAIEvent('model.step.completed', input, modelStepSchema)
}

export function recordChatCompleted(input: v.InferOutput<typeof chatCompletedSchema>): void {
  recordAIEvent('chat.completed', input, chatCompletedSchema)
}

export function recordChatFailed(input: v.InferOutput<typeof chatFailedSchema>): void {
  recordAIEvent('chat.failed', input, chatFailedSchema)
}
