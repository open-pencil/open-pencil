import type { EditorPreparationKind } from '@/app/editor/preparation/types'

import type {
  DiagnosticAttributes,
  DiagnosticEvent,
  DiagnosticEventName,
  DiagnosticValue
} from './types'

export type DiagnosticEventSummary = {
  id: string
  category: string
  label: string
  /** A short line under the label, such as a duration or an error message. */
  detail: string | null
  level: DiagnosticEvent['level']
  timestamp: number
  /** Every recorded field, for the expanded row. */
  fields: [name: string, value: string][]
  stack: string | null
}

/** The diagnostics messages a summary reads; the app's `diagnostics` i18n namespace has them. */
export interface DiagnosticLabels {
  chatCompleted: string
  chatFailed: string
  storageFailed: string
  documentFailed: string
  acpFailed: string
  mcpFailed: string
  modelStep: (values: { model: string }) => string
  modelStepTokens: (values: { input: string; output: string }) => string
  toolCompleted: (values: { tool: string }) => string
  toolFailed: (values: { tool: string }) => string
  durationMs: (values: { ms: number }) => string
  runtimeError: (values: { name: string }) => string
  preparationDocumentOpen: string
  preparationDocumentReload: string
  preparationRecoveryRestore: string
  preparationStorageOpen: string
  preparationPageSwitch: string
  preparationFontRetry: string
  preparationDomImport: string
  preparationDemoLoad: string
  preparationCompleted: (values: { duration: string }) => string
  preparationCancelled: (values: { reason: string; duration: string }) => string
  preparationFailed: (values: { code: string; duration: string }) => string
}

function text(value: DiagnosticValue | undefined): string | null {
  return value === undefined || value === null || value === '' ? null : String(value)
}

/** `errorName: message`, or whichever of the two was recorded. */
function errorDetail(attributes: DiagnosticAttributes): string | null {
  const name = text(attributes.errorName)
  const message = text(attributes.message)
  if (name && message) return `${name}: ${message}`
  return message ?? name ?? text(attributes.errorCode)
}

type Description = [label: string, detail: string | null]
type Describe = (attributes: DiagnosticAttributes, labels: DiagnosticLabels) => Description

const PREPARATION_LABELS = {
  'document-open': 'preparationDocumentOpen',
  'document-reload': 'preparationDocumentReload',
  'recovery-restore': 'preparationRecoveryRestore',
  'storage-open': 'preparationStorageOpen',
  'page-switch': 'preparationPageSwitch',
  'font-retry': 'preparationFontRetry',
  'dom-import': 'preparationDomImport',
  'demo-load': 'preparationDemoLoad'
} as const satisfies Record<EditorPreparationKind, keyof DiagnosticLabels>

/** Preparation records a duration bucket rather than the exact time. */
const DURATION_BUCKETS: Record<string, string> = {
  'under-100ms': '< 100 ms',
  '100ms-1s': '0.1–1 s',
  '1s-5s': '1–5 s',
  '5s-30s': '5–30 s',
  'over-30s': '> 30 s'
}

function isPreparationKind(kind: string): kind is EditorPreparationKind {
  return Object.hasOwn(PREPARATION_LABELS, kind)
}

function preparationOutcome(attributes: DiagnosticAttributes, labels: DiagnosticLabels): string {
  const bucket = text(attributes.durationBucket)
  const duration = (bucket && DURATION_BUCKETS[bucket]) ?? bucket ?? '?'
  switch (attributes.outcome) {
    case 'failed':
      return labels.preparationFailed({ code: text(attributes.failureCode) ?? '?', duration })
    case 'cancelled':
      return labels.preparationCancelled({
        reason: text(attributes.cancellationReason) ?? '?',
        duration
      })
    default:
      return labels.preparationCompleted({ duration })
  }
}

const describePreparation: Describe = (attributes, labels) => {
  const kind = text(attributes.kind) ?? '?'
  const label = isPreparationKind(kind) ? labels[PREPARATION_LABELS[kind]] : kind
  return [label, preparationOutcome(attributes, labels)]
}

/** Typed by event name, so a newly recorded event cannot reach Settings without a label. */
const DESCRIBE: Record<DiagnosticEventName, Describe> = {
  'model.step.completed': (attributes, labels) => [
    labels.modelStep({ model: text(attributes.model) ?? '?' }),
    labels.modelStepTokens({
      input: text(attributes.inputTokens) ?? '?',
      output: text(attributes.outputTokens) ?? '?'
    })
  ],
  'tool.completed': (attributes, labels) => {
    const tool = text(attributes.tool) ?? '?'
    const label =
      attributes.failed === true ? labels.toolFailed({ tool }) : labels.toolCompleted({ tool })
    const ms = attributes.durationMs
    const duration = typeof ms === 'number' ? labels.durationMs({ ms: Math.round(ms) }) : null
    return [label, text(attributes.message) ? errorDetail(attributes) : duration]
  },
  'chat.completed': (attributes, labels) => [labels.chatCompleted, text(attributes.finishReason)],
  'chat.failed': (attributes, labels) => [labels.chatFailed, errorDetail(attributes)],
  'runtime.error': (attributes, labels) => [
    labels.runtimeError({ name: text(attributes.errorName) ?? 'Error' }),
    text(attributes.message)
  ],
  'editor.preparation.finished': describePreparation,
  'storage.operation.failed': (attributes, labels) => [
    labels.storageFailed,
    errorDetail(attributes)
  ],
  'document.operation.failed': (attributes, labels) => [
    labels.documentFailed,
    errorDetail(attributes)
  ],
  'acp.transport.failed': (attributes, labels) => [labels.acpFailed, errorDetail(attributes)],
  'mcp.connection.failed': (attributes, labels) => [labels.mcpFailed, errorDetail(attributes)]
}

function isRecordedEventName(name: string): name is DiagnosticEventName {
  return Object.hasOwn(DESCRIBE, name)
}

function describe(event: DiagnosticEvent, labels: DiagnosticLabels): Description {
  // Events stored by an older version may have a name this one no longer records.
  if (!isRecordedEventName(event.name)) return [event.name, null]
  return DESCRIBE[event.name](event.attributes, labels)
}

export function summarizeDiagnosticEvent(
  event: DiagnosticEvent,
  labels: DiagnosticLabels
): DiagnosticEventSummary {
  const [label, detail] = describe(event, labels)
  const { stack, ...rest } = event.attributes
  const fields = Object.entries(rest).flatMap(([name, value]): [string, string][] => {
    const shown = text(value)
    return shown === null ? [] : [[name, shown]]
  })
  if (event.durationMs !== undefined) fields.push(['durationMs', String(event.durationMs)])
  if (event.runId) fields.push(['runId', event.runId])
  return {
    id: event.id,
    category: event.category,
    label,
    detail,
    level: event.level,
    timestamp: event.timestamp,
    fields,
    stack: text(stack)
  }
}
