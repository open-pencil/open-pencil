// Listed as values so diagnostics can validate recorded events against the same set.
export const EDITOR_PREPARATION_KINDS = [
  'document-open',
  'document-reload',
  'recovery-restore',
  'storage-open',
  'page-switch',
  'font-retry',
  'dom-import',
  'demo-load'
] as const

export type EditorPreparationKind = (typeof EDITOR_PREPARATION_KINDS)[number]

export const EDITOR_PREPARATION_PHASES = [
  'reading',
  'decoding',
  'materializing',
  'populating-page',
  'resolving-fonts',
  'resolving-fallbacks',
  'layout',
  'drawing-shaders',
  'preparing-render'
] as const

export type EditorPreparationPhase = (typeof EDITOR_PREPARATION_PHASES)[number]

export interface EditorPreparationProgress {
  completed: number
  total: number
  unit: 'bytes' | 'nodes' | 'fonts' | 'pages' | 'shaders'
}

export interface EditorPreparation {
  id: number
  kind: EditorPreparationKind
  phase: EditorPreparationPhase
  subject: string | null
  detail: string | null
  progress: EditorPreparationProgress | null
  startedAt: number
}

export interface BeginEditorPreparation {
  kind: EditorPreparationKind
  phase?: EditorPreparationPhase
  subject?: string | null
}

export interface EditorPreparationUpdate {
  phase: EditorPreparationPhase
  detail?: string | null
  completed?: number | null
  total?: number | null
  unit?: EditorPreparationProgress['unit']
}

export const EDITOR_PREPARATION_CANCEL_REASONS = ['superseded', 'tab-closed', 'user'] as const

export type EditorPreparationCancelReason = (typeof EDITOR_PREPARATION_CANCEL_REASONS)[number]

export const EDITOR_PREPARATION_FAILURE_CODES = [
  'read-failed',
  'decode-failed',
  'font-failed',
  'layout-failed',
  'render-failed'
] as const

export interface EditorPreparationFailure {
  id: number
  kind: EditorPreparationKind
  code: (typeof EDITOR_PREPARATION_FAILURE_CODES)[number]
  message: string
  retryable: boolean
}

export type EditorPreparationResult =
  | { id: number; kind: EditorPreparationKind; status: 'completed' }
  | {
      id: number
      kind: EditorPreparationKind
      status: 'cancelled'
      reason: EditorPreparationCancelReason
    }

export interface EditorPreparationHandle {
  readonly id: number
  readonly signal: AbortSignal
  update(update: EditorPreparationUpdate): void
  complete(): void
  fail(failure: Omit<EditorPreparationFailure, 'id' | 'kind'>): void
  cancel(reason?: EditorPreparationCancelReason): void
}

/** The unit a page's preparation counts in, for the phases that count anything. */
export function pageProgressUnit(phase: string): EditorPreparationProgress['unit'] | undefined {
  if (phase === 'resolving-fonts') return 'fonts'
  if (phase === 'drawing-shaders') return 'shaders'
  if (phase === 'populating-page') return 'pages'
  return undefined
}
