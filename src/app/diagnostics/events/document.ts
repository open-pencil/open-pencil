import * as v from 'valibot'

import { recordDiagnostic } from '../recorder'
import type { DiagnosticEvent } from '../types'

const documentFailureSchema = v.object({
  operation: v.picklist(['open', 'save', 'import', 'export']),
  format: v.picklist(['fig', 'pen', 'svg', 'dom-css', 'unknown']),
  errorName: v.string(),
  errorCode: v.nullable(v.string()),
  retryable: v.nullable(v.boolean())
})

export function recordDocumentFailure(input: v.InferOutput<typeof documentFailureSchema>): void {
  const parsed = v.safeParse(documentFailureSchema, input)
  if (!parsed.success) return
  recordDiagnostic({
    category: 'document',
    level: 'error',
    name: 'document.operation.failed',
    attributes: parsed.output
  } satisfies Omit<DiagnosticEvent, 'id' | 'timestamp'>)
}
