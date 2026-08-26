import * as v from 'valibot'

import { recordDiagnostic } from '../recorder'
import type { DiagnosticEvent } from '../types'

const storageFailureSchema = v.object({
  operation: v.picklist(['upload', 'download', 'delete', 'list']),
  errorName: v.string(),
  errorCode: v.nullable(v.string()),
  retryable: v.nullable(v.boolean())
})

export function recordStorageFailure(input: v.InferOutput<typeof storageFailureSchema>): void {
  const parsed = v.safeParse(storageFailureSchema, input)
  if (!parsed.success) return
  recordDiagnostic({
    category: 'storage',
    level: 'error',
    name: 'storage.operation.failed',
    attributes: parsed.output
  } satisfies Omit<DiagnosticEvent, 'id' | 'timestamp'>)
}
