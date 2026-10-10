import type { createSelectionActions } from '#core/editor/selection'
import type { createUndoActions } from '#core/editor/undo'

type SelectionActions = ReturnType<typeof createSelectionActions>
type UndoActions = ReturnType<typeof createUndoActions>

/**
 * `flushPending` commits edits still being coalesced, such as a run of arrow keys, so undo right
 * after them undoes the run, not the edit before it.
 */
export function createUndoBridge(
  undoActions: UndoActions,
  selection: SelectionActions,
  flushPending: () => void
) {
  return {
    commitMove: undoActions.commitMove,
    commitMoveWithReparent: undoActions.commitMoveWithReparent,
    commitDuplicateMove: undoActions.commitDuplicateMove,
    commitResize: undoActions.commitResize,
    commitGroupResize: undoActions.commitGroupResize,
    commitRotation: undoActions.commitRotation,
    commitNodeUpdate: undoActions.commitNodeUpdate,
    undoAction: () => {
      flushPending()
      undoActions.undoAction(selection.validateEnteredContainer)
    },
    redoAction: () => {
      flushPending()
      undoActions.redoAction(selection.validateEnteredContainer)
    },
    snapshotPage: undoActions.snapshotPage,
    restorePageFromSnapshot: undoActions.restorePageFromSnapshot,
    captureDocumentChange: undoActions.captureDocumentChange,
    restoreDocumentChange: undoActions.restoreDocumentChange,
    pushUndoEntry: undoActions.pushUndoEntry,
    pushUndoStep: undoActions.pushUndoStep
  }
}
