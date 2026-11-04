import type { CallWarning, FinishReason } from 'ai'

import type { ThinkingLevel } from '@/app/ai/models/types'

/** A tool as the model was offered it. */
export interface TraceTool {
  name: string
  description?: string
  inputSchema: unknown
}

/** Text or definitions every step of many runs shares, stored once under its fingerprint. */
export type TraceAsset =
  | { kind: 'instructions'; text: string }
  | { kind: 'tools'; tools: TraceTool[] }

/**
 * One model call of a run. Its request is not stored: it is the conversation through the run's
 * input plus the reply's earlier steps, and `request.hash` proves a rebuild matches it.
 */
export interface StepTrace {
  index: number
  finishedAt: string
  durationMs: number
  request: { hash: string; messages: number }
  response: {
    id: string
    modelId: string
    finishReason: FinishReason
    rawFinishReason?: string
  }
  usage: {
    inputTokens: number | null
    outputTokens: number | null
    reasoningTokens: number | null
    cacheReadTokens: number | null
    cacheWriteTokens: number | null
  }
  warnings: CallWarning[]
}

export interface TraceError {
  name: string
  message: string
  statusCode?: number
  responseBody?: string
}

/** One message sent to the model and every step it took to answer. */
export interface RunTrace {
  conversationId: string
  runId: string
  startedAt: string
  endedAt?: string
  model: { provider: string; id: string }
  settings: { maxOutputTokens: number; maxSteps: number; thinking: ThinkingLevel; cache: boolean }
  /** Fingerprints of the shared `TraceAsset`s the run used. */
  instructions: string
  tools?: string
  /** The last conversation message sent; the request is everything through it. */
  input: { through: string | null; messages: number }
  steps: StepTrace[]
  outcome: 'running' | 'completed' | 'stopped' | 'failed'
  /** Why the run failed; the step that failed is `steps.length`. */
  error?: TraceError
}

export interface TraceStore {
  putRun(run: RunTrace): Promise<void>
  listRuns(conversationId: string): Promise<RunTrace[]>
  putAsset(hash: string, asset: TraceAsset): Promise<void>
  getAsset(hash: string): Promise<TraceAsset | undefined>
}
