import { createPageLayouts, type Editor } from '@open-pencil/core'
import { documentThumbnailSubject } from '@open-pencil/core/io/formats/fig'

/**
 * Draws the cover of a document's recovery copies with `draw`, again only once the cover page
 * changed, not for each copy: drawing it costs as much as writing the copy. Null until `draw`
 * gives a cover, such as before the document has a canvas to draw it with.
 */
export function createRecoveryCover(editor: Editor, draw: () => Uint8Array | null) {
  const coverPages = createPageLayouts(editor)
  let last: { pageId: string; nodeIds: string; bytes: Uint8Array } | null = null

  return (): Uint8Array | null => {
    const subject = documentThumbnailSubject(editor.graph)
    if (!subject) return null
    const { pageId } = subject
    // Choosing another thumbnail changes what the cover shows without changing its page.
    const nodeIds = subject.nodeIds?.join(',') ?? ''
    if (last?.pageId === pageId && last.nodeIds === nodeIds && coverPages.isCurrent(pageId))
      return last.bytes
    const bytes = draw()
    if (bytes) {
      coverPages.record(pageId)
      last = { pageId, nodeIds, bytes }
    }
    return bytes
  }
}
