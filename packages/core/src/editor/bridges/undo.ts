import type { createSelectionActions } from '#core/editor/selection'
import type { createUndoActions } from '#core/editor/undo'

type SelectionActions = ReturnType<typeof createSelectionActions>
type UndoActions = ReturnType<typeof createUndoActions>

export function createUndoBridge(undoActions: UndoActions, selection: SelectionActions) {
  return {
    commitMove: undoActions.commitMove,
    commitMoveWithReparent: undoActions.commitMoveWithReparent,
    commitResize: undoActions.commitResize,
    commitRotation: undoActions.commitRotation,
    commitNodeUpdate: undoActions.commitNodeUpdate,
    undoAction: () => undoActions.undoAction(selection.validateEnteredContainer),
    redoAction: () => undoActions.redoAction(selection.validateEnteredContainer),
    snapshotPage: undoActions.snapshotPage,
    restorePageFromSnapshot: undoActions.restorePageFromSnapshot,
    pushUndoEntry: undoActions.pushUndoEntry
  }
}
