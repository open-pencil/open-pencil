import type { DiagnosticEvent } from './types'

export type DiagnosticEventSummary = {
  category: string
  label: string
  level: DiagnosticEvent['level']
  timestamp: number
}

const labelKeys: Record<string, string> = {
  'model.step.completed': 'diagnosticsModelStepCompleted',
  'chat.completed': 'diagnosticsChatCompleted',
  'chat.failed': 'diagnosticsChatFailed',
  'storage.operation.failed': 'diagnosticsStorageFailed',
  'document.operation.failed': 'diagnosticsDocumentFailed',
  'acp.transport.failed': 'diagnosticsACPFailed',
  'mcp.connection.failed': 'diagnosticsMCPFailed'
}

export function summarizeDiagnosticEvent(
  event: DiagnosticEvent,
  labels: Partial<Record<string, unknown>>
): DiagnosticEventSummary {
  const labelKey = labelKeys[event.name]
  const localizedLabel = labelKey ? labels[labelKey] : undefined
  const fallback = labels.diagnosticsTechnicalEvent
  const label =
    typeof localizedLabel === 'string'
      ? localizedLabel
      : typeof fallback === 'string'
        ? fallback
        : 'Technical event'
  return { category: event.category, label, level: event.level, timestamp: event.timestamp }
}
