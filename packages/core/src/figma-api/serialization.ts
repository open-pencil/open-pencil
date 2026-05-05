import type { SceneGraph } from '#core/scene-graph'

import type { NodeProxyHost } from './proxy'

export function nodeProxyToJSON(
  graph: SceneGraph,
  api: NodeProxyHost,
  nodeId: string,
  maxDepth?: number,
  currentDepth = 0
): Record<string, unknown> {
  const n = graph.getNode(nodeId)
  if (!n) return { id: nodeId, removed: true }

  const obj: Record<string, unknown> = {
    id: n.id,
    type: n.type,
    name: n.name,
    x: n.x,
    y: n.y,
    width: n.width,
    height: n.height
  }
  if (n.fills.length > 0) obj.fills = n.fills
  if (n.strokes.length > 0) obj.strokes = n.strokes
  if (n.effects.length > 0) obj.effects = n.effects
  if (n.opacity !== 1) obj.opacity = n.opacity
  if (n.cornerRadius > 0) obj.cornerRadius = n.cornerRadius
  if (!n.visible) obj.visible = false
  if (n.text) obj.characters = n.text
  if (n.type === 'TEXT') obj.textDirection = n.textDirection
  if (n.layoutMode !== 'NONE') {
    obj.layoutMode = n.layoutMode
    obj.layoutDirection = n.layoutDirection
    obj.itemSpacing = n.itemSpacing
  }
  const children = graph.getChildren(nodeId)
  if (children.length > 0) {
    if (maxDepth !== undefined && currentDepth >= maxDepth) {
      obj.childCount = children.length
    } else {
      obj.children = children.map((child) =>
        api.wrapNode(child.id).toJSON(maxDepth, currentDepth + 1)
      )
    }
  }
  return obj
}
