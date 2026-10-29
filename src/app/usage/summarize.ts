import { groupBy, sum } from 'es-toolkit'

import type { DiagnosticEvent } from '@/app/diagnostics/types'

export type UsageModelSummary = {
  provider: string
  model: string
  /** Model calls: a built-in chat reply makes one per step, an agent reply one per turn. */
  steps: number
  inputTokens: number | null
  outputTokens: number | null
}

export type UsageSummary = {
  requests: number
  completedRequests: number
  failedRequests: number
  inputTokens: number | null
  outputTokens: number | null
  cacheReadTokens: number | null
  cacheWriteTokens: number | null
  unavailableCacheTelemetry: number
  models: UsageModelSummary[]
}

function sumAttribute(events: DiagnosticEvent[], name: string): number | null {
  const values = events
    .map((event) => event.attributes[name])
    .filter((value): value is number => typeof value === 'number')
  return values.length === 0 ? null : sum(values)
}

export function summarizeUsage(events: DiagnosticEvent[]): UsageSummary {
  const steps = events.filter((event) => event.name === 'model.step.completed')
  const completedRequests = events.filter((event) => event.name === 'chat.completed').length
  const failedRequests = events.filter((event) => event.name === 'chat.failed').length
  const byModel = groupBy(
    steps,
    (step) =>
      `${String(step.attributes.provider ?? 'unknown')}\u0000${String(step.attributes.model ?? 'unknown')}`
  )
  const models = Object.values(byModel).map((modelSteps) => {
    const first = modelSteps[0]?.attributes ?? {}
    return {
      provider: String(first.provider ?? 'unknown'),
      model: String(first.model ?? 'unknown'),
      steps: modelSteps.length,
      inputTokens: sumAttribute(modelSteps, 'inputTokens'),
      outputTokens: sumAttribute(modelSteps, 'outputTokens')
    }
  })

  return {
    requests: completedRequests + failedRequests,
    completedRequests,
    failedRequests,
    inputTokens: sumAttribute(steps, 'inputTokens'),
    outputTokens: sumAttribute(steps, 'outputTokens'),
    cacheReadTokens: sumAttribute(steps, 'cacheReadTokens'),
    cacheWriteTokens: sumAttribute(steps, 'cacheWriteTokens'),
    unavailableCacheTelemetry: steps.filter(
      (event) =>
        event.attributes.cacheReadTokens === null && event.attributes.cacheWriteTokens === null
    ).length,
    models: models.sort(
      (left, right) =>
        (right.inputTokens ?? 0) +
        (right.outputTokens ?? 0) -
        ((left.inputTokens ?? 0) + (left.outputTokens ?? 0))
    )
  }
}
