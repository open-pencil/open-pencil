import type { SceneGraph } from '@open-pencil/scene-graph'

import type { createClipboardActions } from '#core/editor/clipboard'
import type { CopyOptions } from '#core/editor/clipboard/copy'
import type { createSelectionActions } from '#core/editor/selection'
import type { createSlideActions } from '#core/editor/slides'

type ClipboardActions = ReturnType<typeof createClipboardActions>
type SelectionActions = ReturnType<typeof createSelectionActions>
type SlideActions = ReturnType<typeof createSlideActions>

export function createClipboardBridge(
  clipboard: ClipboardActions,
  selection: SelectionActions,
  slides: SlideActions,
  graph: () => SceneGraph
) {
  /**
   * The selected slides, when the deck's slides are all that is selected: the deck keeps them in
   * order. A slide outside a deck's rows, such as one pasted onto the page, is a layer like any.
   */
  function selectedSlides(): string[] | null {
    const nodes = selection.getSelectedNodes()
    const inDeck = nodes.every(
      (node) => node.type === 'SLIDE' && graph().getNode(node.parentId ?? '')?.type === 'SLIDE_ROW'
    )
    return nodes.length > 0 && inDeck ? nodes.map((node) => node.id) : null
  }

  return {
    duplicateSelected: () => {
      const ids = selectedSlides()
      if (ids) slides.duplicateSlides(ids)
      else clipboard.duplicateSelected(selection.getSelectedNodes())
    },
    duplicateNode: clipboard.duplicateNode,
    prepareCopy: (options?: CopyOptions) =>
      clipboard.prepareCopy(selection.getSelectedNodes(), options),
    pasteSnapshot: clipboard.pasteSnapshot,
    pasteFromHTML: clipboard.pasteFromHTML,
    deleteSelected: () => {
      const ids = selectedSlides()
      if (ids) slides.deleteSlides(ids)
      else clipboard.deleteSelected()
    },
    storeImage: clipboard.storeImage,
    placeFiles: clipboard.placeFiles,
    placeImageFiles: clipboard.placeImageFiles,
    pasteSVG: clipboard.pasteSVG,
    pasteMermaid: clipboard.pasteMermaid,
    pasteText: clipboard.pasteText,
    prepareStyledHTML: clipboard.prepareStyledHTML,
    htmlPasteTarget: clipboard.htmlPasteTarget,
    loadFontsForNodes: clipboard.loadFontsForNodes,
    copySelectionAsText: clipboard.copySelectionAsText,
    copySelectionAsSVG: clipboard.copySelectionAsSVG,
    copySelectionAsJSX: clipboard.copySelectionAsJSX
  }
}
