import { layoutSizing, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

export type OwnSizingField = 'stackPrimarySizing' | 'stackCounterSizing'

/**
 * Whether a frame fills its parent along the axis one of its own sizing fields governs. Figma
 * stores fill on the child and keeps that axis fixed in the frame's own sizing: a hugging value
 * there wins over the fill, so a filled row or button would shrink to its content.
 */
export function fillsOwnSizingAxis(
  graph: SceneGraph,
  node: SceneNode,
  field: OwnSizingField
): boolean {
  if (node.layoutMode !== 'HORIZONTAL' && node.layoutMode !== 'VERTICAL') return false
  const counter = node.layoutMode === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL'
  const axis = field === 'stackPrimarySizing' ? node.layoutMode : counter
  return layoutSizing(graph, node, axis) === 'FILL'
}
