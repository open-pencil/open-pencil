import type { SceneNode } from '@open-pencil/scene-graph'
import { isGeneratedFrame } from '@open-pencil/scene-graph/generated'

// Space between takes the place of the gap in Figma's auto layout. A generated frame keeps it
// as the least space between its sublayers, as a sticky note keeps its author clear of a long body.
function primaryAxisSpacing(node: SceneNode): number {
  return node.primaryAxisAlign === 'SPACE_BETWEEN' && !isGeneratedFrame(node) ? 0 : node.itemSpacing
}

export function primaryAxisGap(node: SceneNode): number {
  return Math.max(0, primaryAxisSpacing(node))
}

// Yoga lays a negative gap out as none, so siblings overlap through negative leading margins.
export function siblingOverlap(node: SceneNode): number {
  if (node.layoutWrap === 'WRAP') {
    return 0
  }
  return Math.max(0, -primaryAxisSpacing(node))
}
