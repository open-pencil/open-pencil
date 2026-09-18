export type EditorPreparationKind =
  | 'document-open'
  | 'document-reload'
  | 'recovery-restore'
  | 'storage-open'
  | 'page-switch'
  | 'font-retry'
  | 'dom-import'
  | 'demo-load'

export type EditorPreparationPhase =
  | 'reading'
  | 'decoding'
  | 'materializing'
  | 'populating-page'
  | 'resolving-fonts'
  | 'resolving-fallbacks'
  | 'layout'
  | 'preparing-render'

export interface EditorPreparationProgress {
  completed: number
  total: number
  unit: 'bytes' | 'nodes' | 'fonts' | 'pages'
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

export type EditorPreparationCancelReason = 'superseded' | 'tab-closed' | 'user'

export interface EditorPreparationFailure {
  id: number
  kind: EditorPreparationKind
  code: 'read-failed' | 'decode-failed' | 'font-failed' | 'layout-failed' | 'render-failed'
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
