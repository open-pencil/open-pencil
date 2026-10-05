import * as v from 'valibot'

import {
  EDITOR_PREPARATION_CANCEL_REASONS,
  EDITOR_PREPARATION_FAILURE_CODES,
  EDITOR_PREPARATION_KINDS,
  EDITOR_PREPARATION_PHASES,
  type EditorPreparationCancelReason,
  type EditorPreparationFailure,
  type EditorPreparationKind,
  type EditorPreparationPhase
} from '@/app/editor/preparation/types'

import { recordDiagnostic } from '../recorder'
import type { DiagnosticEventInput } from '../types'

const durationBuckets = ['under-100ms', '100ms-1s', '1s-5s', '5s-30s', 'over-30s'] as const

const preparationSchema = v.object({
  kind: v.picklist(EDITOR_PREPARATION_KINDS),
  outcome: v.picklist(['completed', 'cancelled', 'failed']),
  cancellationReason: v.nullable(v.picklist(EDITOR_PREPARATION_CANCEL_REASONS)),
  failureCode: v.nullable(v.picklist(EDITOR_PREPARATION_FAILURE_CODES)),
  terminalPhase: v.picklist(EDITOR_PREPARATION_PHASES),
  durationBucket: v.picklist(durationBuckets)
})

export interface PreparationDiagnosticInput {
  kind: EditorPreparationKind
  outcome: 'completed' | 'cancelled' | 'failed'
  cancellationReason: EditorPreparationCancelReason | null
  failureCode: EditorPreparationFailure['code'] | null
  terminalPhase: EditorPreparationPhase
  durationMs: number
}

export function preparationDurationBucket(durationMs: number): (typeof durationBuckets)[number] {
  if (durationMs < 100) return 'under-100ms'
  if (durationMs < 1_000) return '100ms-1s'
  if (durationMs < 5_000) return '1s-5s'
  if (durationMs < 30_000) return '5s-30s'
  return 'over-30s'
}

export function recordPreparationOutcome(input: PreparationDiagnosticInput): void {
  const parsed = v.safeParse(preparationSchema, {
    ...input,
    durationBucket: preparationDurationBucket(input.durationMs)
  })
  if (!parsed.success) return
  recordDiagnostic({
    category: 'document',
    level: input.outcome === 'failed' ? 'error' : 'info',
    name: 'editor.preparation.finished',
    attributes: parsed.output
  } satisfies DiagnosticEventInput)
}
