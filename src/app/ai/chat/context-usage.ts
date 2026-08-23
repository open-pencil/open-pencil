import type { StepUsage } from '@/app/ai/tools'

export type ContextUsage = {
  usedTokens: number
  totalTokens?: number
  percentUsed?: number
  percentLeft?: number
}

export function calculateContextUsage(
  steps: readonly StepUsage[],
  contextWindowTokens?: number
): ContextUsage | null {
  const latest = steps.at(-1)
  if (!latest) return null

  const usedTokens = latest.inputTokens + latest.outputTokens
  if (!contextWindowTokens || contextWindowTokens <= 0) return { usedTokens }

  const percentUsed = Math.min(100, Math.round((usedTokens / contextWindowTokens) * 100))
  return {
    usedTokens,
    totalTokens: contextWindowTokens,
    percentUsed,
    percentLeft: 100 - percentUsed
  }
}

export function formatTokenCount(tokens: number): string {
  if (tokens < 1_000) return String(tokens)
  const divisor = tokens < 1_000_000 ? 1_000 : 1_000_000
  const suffix = tokens < 1_000_000 ? 'k' : 'M'
  const scaled = tokens / divisor
  const digits = scaled < 10 && !Number.isInteger(scaled) ? 1 : 0
  return `${scaled.toFixed(digits)}${suffix}`
}
