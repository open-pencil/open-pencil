import type { createClipboardActions } from '#core/editor/clipboard'
import type { createSelectionActions } from '#core/editor/selection'

type ClipboardActions = ReturnType<typeof createClipboardActions>
type SelectionActions = ReturnType<typeof createSelectionActions>

export function createClipboardBridge(clipboard: ClipboardActions, selection: SelectionActions) {
  return {
    duplicateSelected: () => clipboard.duplicateSelected(selection.getSelectedNodes()),
    duplicateNode: clipboard.duplicateNode,
    prepareCopy: () => clipboard.prepareCopy(selection.getSelectedNodes()),
    pasteSnapshot: clipboard.pasteSnapshot,
    pasteFromHTML: clipboard.pasteFromHTML,
    deleteSelected: clipboard.deleteSelected,
    storeImage: clipboard.storeImage,
    placeFiles: clipboard.placeFiles,
    placeImageFiles: clipboard.placeImageFiles,
    pasteSVG: clipboard.pasteSVG,
    loadFontsForNodes: clipboard.loadFontsForNodes,
    copySelectionAsText: clipboard.copySelectionAsText,
    copySelectionAsSVG: clipboard.copySelectionAsSVG,
    copySelectionAsJSX: clipboard.copySelectionAsJSX
  }
}
