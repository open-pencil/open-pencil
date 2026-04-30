import type { createClipboardActions } from '#core/editor/clipboard'
import type { createSelectionActions } from '#core/editor/selection'

type ClipboardActions = ReturnType<typeof createClipboardActions>
type SelectionActions = ReturnType<typeof createSelectionActions>

export function createClipboardBridge(clipboard: ClipboardActions, selection: SelectionActions) {
  return {
    duplicateSelected: () => clipboard.duplicateSelected(selection.getSelectedNodes()),
    writeCopyData: (data: DataTransfer) =>
      clipboard.writeCopyData(data, selection.getSelectedNodes()),
    pasteFromHTML: clipboard.pasteFromHTML,
    deleteSelected: clipboard.deleteSelected,
    storeImage: clipboard.storeImage,
    placeImageFiles: clipboard.placeImageFiles,
    loadFontsForNodes: clipboard.loadFontsForNodes,
    copySelectionAsText: clipboard.copySelectionAsText,
    copySelectionAsSVG: clipboard.copySelectionAsSVG,
    copySelectionAsJSX: clipboard.copySelectionAsJSX
  }
}
