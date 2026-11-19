import type { SceneNode } from '../types'

/**
 * The stroke a frame counts inside its padding, per side: its visible INSIDE strokes when its
 * strokes are included in layout, as Figma lays it out and as a CSS border takes room.
 */
export function includedStrokeWeights(
  node: SceneNode
): Record<'top' | 'right' | 'bottom' | 'left', number> {
  const stroke = node.strokes.find((paint) => paint.visible)
  if (!node.strokesIncludedInLayout || stroke?.align !== 'INSIDE') {
    return { top: 0, right: 0, bottom: 0, left: 0 }
  }
  if (!node.independentStrokeWeights) {
    return { top: stroke.weight, right: stroke.weight, bottom: stroke.weight, left: stroke.weight }
  }
  return {
    top: node.borderTopWeight,
    right: node.borderRightWeight,
    bottom: node.borderBottomWeight,
    left: node.borderLeftWeight
  }
}
