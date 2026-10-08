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

/** Every event the app records; Settings needs a label for each (`summary.ts`). */
export type DiagnosticEventName =
  | 'model.step.completed'
  | 'chat.completed'
  | 'chat.failed'
  | 'tool.completed'
  | 'runtime.error'
  | 'editor.preparation.finished'
  | 'document.operation.failed'
  | 'storage.operation.failed'
  | 'mcp.connection.failed'
  | 'acp.transport.failed'

export type DiagnosticEvent = {
  id: string
  timestamp: number
  category: DiagnosticCategory
  level: DiagnosticLevel
  /** A `DiagnosticEventName`, or an older name read back from storage. */
  name: string
  sessionId?: string
  runId?: string
  durationMs?: number
  attributes: DiagnosticAttributes
}

export type DiagnosticEventInput = Omit<DiagnosticEvent, 'id' | 'timestamp' | 'name'> & {
  name: DiagnosticEventName
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
