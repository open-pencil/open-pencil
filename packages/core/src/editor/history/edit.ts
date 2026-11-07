import {
  captureDocumentChange,
  emptyDocumentChange,
  isEmptyDocumentChange,
  restoreDocumentChange,
  type DocumentChange
} from '#core/editor/history/document-change'
import type { EditorContext } from '#core/editor/types'

export interface RecordEditOptions {
  /** The undo step's label. */
  label: string
  /** The page the edit is made from; it is recorded wherever in the document it lands. */
  pageId?: string
  /** False for an edit that records its own steps, such as an atomic tool's. */
  push?: boolean
  /**
   * Records the step on its own, settling any batch first, rather than as part of an open batch.
   * An edit that finishes after an await needs this: a batch open by then belongs to another
   * edit, such as a picker drag. `recordEditAsync` always does.
   */
  ownStep?: boolean
  /**
   * Receives what the edit changed, before its step closes; an edit that failed changed nothing,
   * as it is rolled back.
   */
  onRecorded?: (change: DocumentChange) => void
}

function begin(ctx: EditorContext, options: RecordEditOptions) {
  const pageId = options.pageId ?? ctx.state.currentPageId
  const finish = captureDocumentChange(ctx.graph, pageId)
  return (failed: boolean) => {
    const change = finish()
    // A failed edit leaves nothing half done: what it changed goes back, and no step is left.
    if (failed) {
      if (!isEmptyDocumentChange(change)) restoreDocumentChange(ctx, change, 'before')
      options.onRecorded?.(emptyDocumentChange(pageId))
      return
    }
    // An edit that changed nothing, such as a read-only script, leaves no empty step behind.
    if (options.push !== false && !isEmptyDocumentChange(change)) {
      const entry = {
        label: options.label,
        forward: () => restoreDocumentChange(ctx, change, 'after'),
        inverse: () => restoreDocumentChange(ctx, change, 'before')
      }
      if (options.ownStep) ctx.undo.pushStep(entry)
      else ctx.undo.push(entry)
    }
    options.onRecorded?.(change)
  }
}

/**
 * Runs a synchronous edit as one undo step of everything it changed in the document. One that
 * throws part way is rolled back and leaves no step. Its step is recorded in the same task as its
 * changes, as the document's unsaved state expects of an edit, and joins a batch open around it.
 */
export function recordEdit<T>(ctx: EditorContext, options: RecordEditOptions, run: () => T): T {
  const finish = begin(ctx, options)
  let failed = true
  try {
    const result = run()
    failed = false
    return result
  } finally {
    finish(failed)
  }
}

/**
 * Runs an edit that awaits before it finishes, such as an agent's tool call that loads fonts or
 * runs a layout, as one undo step; one that rejects is rolled back and leaves no step. The edit
 * stays open until its step is recorded, so the changes it makes meanwhile count as its own
 * rather than as edits outside the history. An edit made elsewhere while it runs, such as the
 * user's, lands in the same step unless the edit waits outside itself
 * (`SceneGraph.waitOutsideEdit`): nothing else tells whose write is whose across an await. An edit
 * that can compute first and apply in one go records only the apply with `recordEdit` instead.
 */
export async function recordEditAsync<T>(
  ctx: EditorContext,
  options: RecordEditOptions,
  run: () => Promise<T>
): Promise<T> {
  // Capturing can throw; the edit opens only once it has, so a failure never leaves it open.
  const finish = begin(ctx, { ...options, ownStep: true })
  const close = ctx.undo.openEdit()
  let failed = true
  try {
    const result = await run()
    failed = false
    return result
  } finally {
    try {
      finish(failed)
    } finally {
      close()
    }
  }
}
