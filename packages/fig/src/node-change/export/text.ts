import type { SceneNode } from '@open-pencil/scene-graph'

import { applyTextRunReferences } from '../text/run-references'
import type { KiwiNodeChange, SceneNodeToKiwiContext } from './context'

/** A text's props, and what its ranges refer to, which needs the document's identities. */
export function serializeText(
  context: SceneNodeToKiwiContext,
  node: SceneNode,
  nc: KiwiNodeChange
): void {
  context.serializeTextProps(
    node,
    nc,
    context.graph,
    context.fontDigestMap,
    context.blobs,
    context.glyphBlobMap
  )
  if (nc.textData) applyTextRunReferences(context, node, nc.textData)
}
