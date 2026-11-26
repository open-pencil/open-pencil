import type { SceneNode } from '@open-pencil/scene-graph'
import { counterAxisSpacingOf, primaryAxisSpacingOf } from '@open-pencil/scene-graph/layout'

export function primaryAxisGap(node: SceneNode): number {
  return Math.max(0, primaryAxisSpacingOf(node))
}

// The space between wrapped lines. Wrapped lines never overlap: Figma lays a negative spacing
// between them out as none.
export function counterAxisGap(node: SceneNode): number {
  return Math.max(0, counterAxisSpacingOf(node))
}

// CSS lays a negative gap out as none, so siblings overlap through negative trailing margins.
// Figma keeps the overlap inside each wrapped row too; only the space between rows stays >= 0.
export function siblingOverlap(node: SceneNode): number {
  return Math.max(0, -primaryAxisSpacingOf(node))
}
