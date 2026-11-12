import { createPageLayouts, type Editor } from '@open-pencil/core'
import { figThumbnailPageId } from '@open-pencil/core/io/formats/fig'

/**
 * Draws the cover of a document's recovery copies with `draw`, again only once the cover page
 * changed, not for each copy: drawing it costs as much as writing the copy. Null until `draw`
 * gives a cover, such as before the document has a canvas to draw it with.
 */
export function createRecoveryCover(editor: Editor, draw: () => Uint8Array | null) {
  const coverPages = createPageLayouts(editor)
  let last: { pageId: string; bytes: Uint8Array } | null = null

  return (): Uint8Array | null => {
    const pageId = figThumbnailPageId(editor.graph.getPages())
    if (!pageId) return null
    if (last?.pageId === pageId && coverPages.isCurrent(pageId)) return last.bytes
    const bytes = draw()
    if (bytes) {
      coverPages.record(pageId)
      last = { pageId, bytes }
    }
    return bytes
  }
}
