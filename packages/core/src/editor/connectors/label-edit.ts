import type { SceneNode } from '@open-pencil/scene-graph'
import { labelledConnector } from '@open-pencil/scene-graph/connectors'

import type { EditorContext } from '#core/editor/types'
import { measureTextForLayout } from '#core/layout/text-measurement'

/**
 * Sizes an empty connector label to the placeholder its canvas shows while it is typed into, as
 * FigJam sizes the box it outlines then, and returns what puts the label's size back if it is
 * left empty. The size is a preview: the label's text sizes it once typed.
 */
export function fitEmptyLabelToPlaceholder(
  ctx: EditorContext,
  node: SceneNode
): (() => void) | null {
  // The scene's renderer carries the placeholder; an overlay renderer draws no text.
  const placeholder = [...ctx.getRenderers()].find(
    (renderer) => renderer.connectorLabelPlaceholder
  )?.connectorLabelPlaceholder
  if (!placeholder || node.text !== '' || !labelledConnector(ctx.graph, node)) return null
  const before = { width: node.width, height: node.height }
  ctx.graph.updateNodePreview(node.id, measureTextForLayout({ ...node, text: placeholder }))
  return () => {
    const label = ctx.graph.getNode(node.id)
    if (label?.text === '') ctx.graph.updateNodePreview(node.id, before)
  }
}
