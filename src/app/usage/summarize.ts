import type { DiagnosticEvent } from '@/app/diagnostics/types'

export type UsageModelSummary = {
  provider: string
  model: string
  requests: number
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
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0)
}

export function summarizeUsage(events: DiagnosticEvent[]): UsageSummary {
  const steps = events.filter((event) => event.name === 'model.step.completed')
  const completedRequests = events.filter((event) => event.name === 'chat.completed').length
  const failedRequests = events.filter((event) => event.name === 'chat.failed').length
  const modelCounts = new Map<string, UsageModelSummary>()

  for (const step of steps) {
    const provider = String(step.attributes.provider ?? 'unknown')
    const model = String(step.attributes.model ?? 'unknown')
    const key = `${provider}\u0000${model}`
    const current = modelCounts.get(key)
    if (current) current.requests++
    else modelCounts.set(key, { provider, model, requests: 1 })
  }

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
    models: [...modelCounts.values()].sort((left, right) => right.requests - left.requests)
  }
}
