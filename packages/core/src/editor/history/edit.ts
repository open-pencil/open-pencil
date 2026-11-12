import type { UndoEntry } from '@open-pencil/scene-graph/undo'

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
   * Undo selects what was selected before the edit and redo what it left selected, as Figma does
   * after Group or Ungroup, rather than clearing the selection.
   */
  restoresSelection?: boolean
  /**
   * Records the step on its own, settling any batch first, rather than as part of an open batch.
   * An edit that finishes after an await needs this: a batch open by then belongs to another
   * edit, such as a picker drag. `recordEditAsync` always does.
   */
  ownStep?: boolean
  /**
   * The step this edit responds to, which it joins rather than recording one, as a host snapping
   * a dropped layer into place does: undo and redo take both back together. `history:changed`
   * passes the step it recorded. Once that step is no longer the newest, undone or followed by
   * another, or while a batch is open, the response comes too late: its changes are undone and
   * nothing is recorded.
   */
  joinStep?: UndoEntry
  /**
   * Receives what the edit changed, before its step closes; an edit that failed changed nothing,
   * as it is rolled back.
   */
  onRecorded?: (change: DocumentChange) => void
}

/** An edit that awaits records a step of its own: what it would join can move on meanwhile. */
export type AsyncRecordEditOptions = Omit<RecordEditOptions, 'joinStep'>

function begin(ctx: EditorContext, options: RecordEditOptions) {
  const pageId = options.pageId ?? ctx.state.currentPageId
  const selectedBefore = options.restoresSelection ? new Set(ctx.state.selectedIds) : undefined
  const finish = captureDocumentChange(ctx.graph, pageId)
  /** Ends the edit; true when it left no step, rolled back or changing nothing. */
  return (failed: boolean): boolean => {
    const change = finish()
    // A response whose step has moved on would change a document that is no longer the one it
    // answered, so it goes back as a failed edit does.
    const stale =
      options.joinStep !== undefined &&
      (ctx.undo.peekUndo() !== options.joinStep || ctx.undo.isBatching)
    // A failed edit leaves nothing half done: what it changed goes back, and no step is left.
    if (failed || stale) {
      if (!isEmptyDocumentChange(change)) {
        restoreDocumentChange(ctx, change, 'before', selectedBefore)
      }
      options.onRecorded?.(emptyDocumentChange(pageId))
      return true
    }
    // An edit that records its own step, such as an atomic tool's, reports its own outcome.
    if (options.push === false) {
      options.onRecorded?.(change)
      return false
    }
    // An edit that changed nothing, such as a read-only script, leaves no empty step behind.
    if (!isEmptyDocumentChange(change)) {
      const selectedAfter = selectedBefore && new Set(ctx.state.selectedIds)
      const entry = {
        label: options.label,
        forward: () => restoreDocumentChange(ctx, change, 'after', selectedAfter),
        inverse: () => restoreDocumentChange(ctx, change, 'before', selectedBefore)
      }
      if (options.joinStep) ctx.undo.extendLastStep(entry)
      else if (options.ownStep) ctx.undo.pushStep(entry)
      else ctx.undo.push(entry)
    }
    options.onRecorded?.(change)
    return isEmptyDocumentChange(change)
  }
}

/**
 * Runs a synchronous edit as one undo step of everything it changed in the document. One that
 * throws part way is rolled back and leaves no step. Its step is recorded in the same task as its
 * changes, as the document's unsaved state expects of an edit, and joins a batch open around it.
 */
export function recordEdit<T>(ctx: EditorContext, options: RecordEditOptions, run: () => T): T {
  const finish = begin(ctx, options)
  // Open while it runs, so its changes wait for its step rather than count as outside history.
  const close = ctx.undo.openEdit()
  let failed = true
  let discarded = false
  try {
    const result = run()
    failed = false
    return result
  } finally {
    try {
      discarded = finish(failed)
    } finally {
      close()
    }
    if (discarded) ctx.undo.discardEdit()
  }
}

/**
 * Runs an edit that awaits before it finishes, such as an agent's tool call that loads fonts or
 * runs a layout, as one undo step; one that rejects is rolled back and leaves no step. The edit
 * stays open until its step is recorded, so the changes it makes meanwhile count as its own
 * rather than as edits outside the history. A collaborator's change and an undo or redo run
 * outside it (`SceneGraph.runOutsideEdits`); another edit made while it runs, such as the user's,
 * lands in the same step unless the edit waits outside itself (`SceneGraph.waitOutsideEdit`):
 * nothing else tells whose write is whose across an await. An edit
 * that can compute first and apply in one go records only the apply with `recordEdit` instead.
 */
export async function recordEditAsync<T>(
  ctx: EditorContext,
  options: AsyncRecordEditOptions,
  run: () => Promise<T>
): Promise<T> {
  // The step it would join can be undone or followed by another while it awaits.
  if ('joinStep' in options) {
    throw new TypeError('recordEditAsync records a step of its own; join a step with recordEdit')
  }
  // Capturing can throw; the edit opens only once it has, so a failure never leaves it open.
  const finish = begin(ctx, { ...options, ownStep: true })
  const close = ctx.undo.openEdit()
  let failed = true
  let discarded = false
  try {
    const result = await run()
    failed = false
    return result
  } finally {
    try {
      discarded = finish(failed)
    } finally {
      close()
    }
    // Reported once the edit has closed, so the unsaved state sees whether another is open.
    if (discarded) ctx.undo.discardEdit()
  }
}
