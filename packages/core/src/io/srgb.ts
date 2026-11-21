import type { SceneGraph } from '@open-pencil/scene-graph'

import { extractExportGraph } from './subgraph'

export interface SRGBDocument {
  graph: SceneGraph
  /**
   * Whether `graph` is a converted copy. It keeps the document's layer ids, so it is drawn by a
   * renderer that has not drawn the document, such as the headless one, never the host's own.
   */
  copied: boolean
}

/**
 * `source`, or a copy of it with every color brought into sRGB when it is in another profile, for
 * a format that holds sRGB colors only, such as PPTX, draw.io, or PDF: a Display P3 document's
 * colors are mapped inside sRGB, not written as if their numbers were sRGB.
 */
export async function graphInSRGB(source: SceneGraph): Promise<SRGBDocument> {
  if (source.documentColorSpace === 'srgb') return { graph: source, copied: false }
  const { convertDocumentColors } = await import('#core/editor/color-space/convert')
  const { graph } = extractExportGraph(source, { scope: 'document' })
  convertDocumentColors(graph, 'srgb')
  return { graph, copied: true }
}
