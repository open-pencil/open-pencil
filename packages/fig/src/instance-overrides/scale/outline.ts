import type { InstanceOccurrence } from '../occurrence/types'

/**
 * A vector's inherited outlines follow every resize its occurrence goes through, per axis: the
 * instance's uniform scale and then any constraint resize. Saved derived outlines, applied
 * after both, are already at the placed size and replace them.
 */
export function growInheritedOutlineScale(
  occurrence: InstanceOccurrence,
  x: number,
  y: number
): void {
  if (x === 1 && y === 1) return
  const inherited = occurrence.inheritedOutlineScale ?? {
    fill: { x: 1, y: 1 },
    stroke: { x: 1, y: 1 }
  }
  occurrence.inheritedOutlineScale = {
    fill: { x: inherited.fill.x * x, y: inherited.fill.y * y },
    stroke: { x: inherited.stroke.x * x, y: inherited.stroke.y * y }
  }
}
