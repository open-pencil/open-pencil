import {
  findFigThumbnailPageId,
  populateFigPage,
  readFigFile
} from '@open-pencil/core/io/formats/fig'
import { computeAllLayouts } from '@open-pencil/core/layout'
import type { SceneGraph } from '@open-pencil/scene-graph'

export function readFigDocument(file: File, signal?: AbortSignal) {
  return readFigFile(file, {
    populate: 'first-page',
    signal
  })
}

/** Reads a .fig with its first page, and its cover page when it has one, laid out to draw. */
export async function readFigForDisplay(file: File, signal?: AbortSignal): Promise<SceneGraph> {
  const imported = await readFigDocument(file, signal)
  const firstPageId = imported.getPages()[0]?.id
  const layOut = (pageId: string) =>
    imported.applyDerivedLayoutDuring(() => computeAllLayouts(imported, pageId))
  if (firstPageId) layOut(firstPageId)
  const coverPageId = findFigThumbnailPageId(imported.getPages())
  if (coverPageId && coverPageId !== firstPageId) {
    populateFigPage(imported, coverPageId)
    layOut(coverPageId)
  }
  return imported
}
