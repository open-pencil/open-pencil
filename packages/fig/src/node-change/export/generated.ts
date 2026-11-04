import type { SceneNode } from '@open-pencil/scene-graph'
import { generatedFrameKind } from '@open-pencil/scene-graph/generated'

import { generatedFrameCodec } from '../generated/codecs'
import type { KiwiNodeChange, SceneNodeToKiwiContext } from './context'

/**
 * Whether a layer is written as a generated frame: one whose type has a codec and which still has
 * its template's layers. One that lost them is written as a plain frame with its children, so
 * nothing it shows is lost.
 */
export function writesGeneratedFrame(context: SceneNodeToKiwiContext, node: SceneNode): boolean {
  const complete = generatedFrameKind(node)?.complete(context.graph, node) ?? false
  return complete && generatedFrameCodec(node.type) !== undefined
}

/**
 * A generated frame's record, with its sublayers written on it as its type's codec writes them;
 * null for any other layer.
 */
export function generatedFrameRecord(
  context: SceneNodeToKiwiContext,
  node: SceneNode,
  nc: KiwiNodeChange
): KiwiNodeChange | null {
  if (!writesGeneratedFrame(context, node)) return null
  return generatedFrameCodec(node.type)?.write(context, node, nc) ?? null
}
