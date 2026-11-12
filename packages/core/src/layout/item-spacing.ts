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

// The space between wrapped lines. A `.fig` saves it as NaN while it follows the item spacing,
// as Figma's `counterAxisSpacing: null` does. Wrapped lines never overlap: Figma lays a negative
// spacing between them out as none.
export function counterAxisGap(node: SceneNode): number {
  const spacing = Number.isNaN(node.counterAxisSpacing) ? node.itemSpacing : node.counterAxisSpacing
  return Math.max(0, spacing)
}

// CSS lays a negative gap out as none, so siblings overlap through negative trailing margins.
// Figma keeps the overlap inside each wrapped row too; only the space between rows stays >= 0.
export function siblingOverlap(node: SceneNode): number {
  return Math.max(0, -primaryAxisSpacing(node))
}
