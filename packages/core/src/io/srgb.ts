import type { SceneGraph } from '@open-pencil/scene-graph'

import { extractExportGraph } from './subgraph'

/**
 * `graph`, or a copy of it with every color brought into sRGB when it is in another profile, for
 * a format that holds sRGB colors only, such as PPTX, draw.io, or PDF: a Display P3 document's
 * colors are mapped inside sRGB, not written as if their numbers were sRGB. The copy keeps the
 * document's layer ids, so it must be drawn by a renderer that has not drawn the document.
 */
export async function graphInSRGB(source: SceneGraph): Promise<SceneGraph> {
  if (source.documentColorSpace === 'srgb') return source
  const { convertDocumentColors } = await import('#core/editor/color-space/convert')
  const { graph } = extractExportGraph(source, { scope: 'document' })
  convertDocumentColors(graph, 'srgb')
  return graph
}
