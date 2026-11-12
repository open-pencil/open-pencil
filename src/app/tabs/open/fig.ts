import { figThumbnailPageId, populateFigPage } from '@open-pencil/core/io/formats/fig'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { prepareGraphFonts } from '@open-pencil/core/text'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { readFigDocument } from '@/app/document/io/fig'
import { loadFont } from '@/app/editor/fonts'

/** Reads a `.fig` file with its first page and its cover page laid out in prepared fonts. */
export async function readFigForTab(file: File, signal?: AbortSignal): Promise<SceneGraph> {
  const imported = await readFigDocument(file, signal)
  const firstPageId = imported.getPages()[0]?.id
  // Each page is laid out once its text's fonts are prepared, never in a face it would lose.
  const layOut = async (pageId: string) => {
    await prepareGraphFonts(imported, [pageId], { loadFont, signal })
    imported.applyDerivedLayoutDuring(() => computeAllLayouts(imported, pageId))
  }
  if (firstPageId) await layOut(firstPageId)
  const thumbnailPageId = figThumbnailPageId(imported.getPages())
  if (thumbnailPageId && thumbnailPageId !== firstPageId) {
    populateFigPage(imported, thumbnailPageId)
    await layOut(thumbnailPageId)
  }
  return imported
}

/** A `.fig` file named after its document, holding a copy of the bytes. */
export function figFile(bytes: Uint8Array, name: string): File {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new File([copy.buffer], `${name}.fig`, { type: 'application/octet-stream' })
}

/**
 * Reads a `.fig` file's bytes as a tab opens them, laid out and ready to show, for an editor of
 * its own such as an earlier version's preview.
 */
export function readFigBytes(
  bytes: Uint8Array,
  name: string,
  signal?: AbortSignal
): Promise<SceneGraph> {
  return readFigForTab(figFile(bytes, name), signal)
}
