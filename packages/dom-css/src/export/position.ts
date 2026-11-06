import type { ConstraintType, SceneNode } from '@open-pencil/scene-graph'

import type { DesignStyleDeclaration } from '../types'

const AXES = {
  width: { constraint: 'horizontalConstraint', start: 'left', end: 'right', at: 'x' },
  height: { constraint: 'verticalConstraint', start: 'top', end: 'bottom', at: 'y' }
} as const

type Axis = keyof typeof AXES

const length = (value: number) => `${Number(value.toFixed(3))}px`
const percent = (value: number) => `${Number((value * 100).toFixed(4))}%`

function constraintOf(node: SceneNode, parent: SceneNode | undefined, axis: Axis): ConstraintType {
  return parent ? node[AXES[axis].constraint] : 'MIN'
}

/**
 * Whether a placed layer's constraint sizes it along an axis: Left and Right leave the size to
 * both edges, and Scale sets its share of the parent, so neither takes a fixed size.
 */
export function constraintSizes(
  node: SceneNode,
  parent: SceneNode | undefined,
  axis: Axis
): boolean {
  const constraint = constraintOf(node, parent, axis)
  return constraint === 'STRETCH' || (constraint === 'SCALE' && (parent?.[axis] ?? 0) > 0)
}

/**
 * Whether a layer's parent leaves it to its coordinates: it is absolutely positioned, or its
 * parent frame has no auto layout. The parent it is placed in is the one its constraints follow.
 */
export function placement(
  node: SceneNode,
  parent: SceneNode | undefined
): { parent: SceneNode | undefined } | null {
  const frame = parent?.type === 'CANVAS' ? undefined : parent
  if (node.layoutPositioning === 'ABSOLUTE' || frame?.layoutMode === 'NONE')
    return { parent: frame }
  return null
}

/**
 * Place a layer by its constraints when its parent does not lay it out. A frame without auto
 * layout becomes the containing block of the children it places.
 */
export function addPositioning(
  style: DesignStyleDeclaration,
  node: SceneNode,
  parent: SceneNode | undefined
): void {
  const placed = placement(node, parent)
  if (placed) {
    style.position = 'absolute'
    addConstrainedPlacement(style, node, placed.parent)
  } else if (node.layoutMode === 'NONE' && node.type !== 'TEXT' && node.childIds.length > 0) {
    style.position = 'relative'
  }
}

/**
 * Place a layer by its constraints, so it follows the parent when the page resizes it as the
 * canvas does (`resize.ts` in `@open-pencil/scene-graph`): Left and Top keep the start edge,
 * Right and Bottom the end edge, Center the offset from the centre, Left and Right both edges,
 * and Scale its share of the parent.
 */
function addConstrainedPlacement(
  style: DesignStyleDeclaration,
  node: SceneNode,
  parent: SceneNode | undefined
): void {
  for (const axis of ['width', 'height'] as const) {
    const { start, end, at } = AXES[axis]
    const constraint = constraintOf(node, parent, axis)
    const parentSize = parent?.[axis] ?? 0
    const before = node[at]
    const after = parentSize - before - node[axis]
    if (constraint === 'MAX') {
      style[end] = length(after)
    } else if (constraint === 'CENTER') {
      const offset = before - parentSize / 2
      style[start] =
        offset === 0 ? '50%' : `calc(50% ${offset < 0 ? '-' : '+'} ${length(Math.abs(offset))})`
    } else if (constraint === 'STRETCH') {
      style[start] = length(before)
      style[end] = length(after)
    } else if (constraint === 'SCALE' && parentSize > 0) {
      style[start] = percent(before / parentSize)
      style[axis] = percent(node[axis] / parentSize)
    } else {
      style[start] = length(before)
    }
  }
}
