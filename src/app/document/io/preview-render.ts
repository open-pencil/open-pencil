import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { renderOffscreenThumbnail } from '@open-pencil/core/io/formats/raster'
import type { SceneGraph } from '@open-pencil/scene-graph'

/** Longest side, in pixels, of a design preview. */
export const DOCUMENT_PREVIEW_SIZE = 512

/** Draws a PNG preview of a design that is not open in any tab. */
export async function renderOffscreenPreview(graph: SceneGraph): Promise<Uint8Array | null> {
  return renderOffscreenThumbnail(await getCanvasKit(), graph, DOCUMENT_PREVIEW_SIZE)
}
