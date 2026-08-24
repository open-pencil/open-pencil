import type { AIProviderID } from '@open-pencil/core/constants'

export type DiagnosticCategory =
  | 'ai'
  | 'document'
  | 'renderer'
  | 'storage'
  | 'sync'
  | 'mcp'
  | 'recovery'
  | 'performance'
  | 'runtime'

export type DiagnosticLevel = 'debug' | 'info' | 'warning' | 'error'
export type DiagnosticValue = string | number | boolean | null
export type DiagnosticAttributes = Readonly<Record<string, DiagnosticValue>>

export type DiagnosticEvent = {
  id: string
  timestamp: number
  category: DiagnosticCategory
  level: DiagnosticLevel
  name: string
  sessionId?: string
  runId?: string
  durationMs?: number
  attributes: DiagnosticAttributes
}

export type DiagnosticEventInput = Omit<DiagnosticEvent, 'id' | 'timestamp'> & {
  timestamp?: number
}

export type AIDiagnosticUsage = {
  providerID: AIProviderID
  modelID: string
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  finishReason?: string
}
