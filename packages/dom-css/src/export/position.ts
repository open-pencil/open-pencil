import type { ConstraintType, SceneNode } from '@open-pencil/scene-graph'

import type { DesignStyleDeclaration } from '../types'
import { borderWidths } from './css'

const AXES = {
  width: { constraint: 'horizontalConstraint', start: 'left', end: 'right', at: 'x' },
  height: { constraint: 'verticalConstraint', start: 'top', end: 'bottom', at: 'y' }
} as const

type Axis = keyof typeof AXES

const length = (value: number) => `${Number(value.toFixed(3))}px`
const percent = (value: number) => `${Number((value * 100).toFixed(4))}%`

/** A percentage of the containing block moved by a length, as `calc()` when it moves. */
function shifted(base: string, by: number): string {
  if (Number(by.toFixed(3)) === 0) return base
  return `calc(${base} ${by < 0 ? '-' : '+'} ${length(Math.abs(by))})`
}

/**
 * A placed layer along one axis, measured in the box CSS places it in: inside the parent's
 * border, which a stroke on the canvas does not take from its children. A parent with no size
 * on the axis leaves its box to the page, so its children keep their start and size there.
 */
function placedAxis(node: SceneNode, parent: SceneNode | undefined, axis: Axis) {
  const { constraint, start, end, at } = AXES[axis]
  const border = parent ? borderWidths(parent) : undefined
  const inset = border?.[start] ?? 0
  const room = (parent?.[axis] ?? 0) - inset - (border?.[end] ?? 0)
  const kind: ConstraintType = parent && room > 0 ? node[constraint] : 'MIN'
  const before = node[at] - inset
  return { kind, room, before, after: room - before - node[axis] }
}

/**
 * Whether a placed layer's constraint sizes it along an axis: Left and Right and Scale both size
 * it from the parent, so it takes no fixed size.
 */
export function constraintSizes(
  node: SceneNode,
  parent: SceneNode | undefined,
  axis: Axis
): boolean {
  const { kind } = placedAxis(node, parent, axis)
  return kind === 'STRETCH' || kind === 'SCALE'
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
 * and Scale its share of the parent. A stretched size is written out rather than left to both
 * edges, which an image would not fill.
 */
function addConstrainedPlacement(
  style: DesignStyleDeclaration,
  node: SceneNode,
  parent: SceneNode | undefined
): void {
  for (const axis of ['width', 'height'] as const) {
    const { start, end } = AXES[axis]
    const { kind, room, before, after } = placedAxis(node, parent, axis)
    if (kind === 'MAX') {
      style[end] = length(after)
    } else if (kind === 'CENTER') {
      style[start] = shifted('50%', before - room / 2)
    } else if (kind === 'STRETCH') {
      style[start] = length(before)
      style[axis] = shifted('100%', node[axis] - room)
    } else if (kind === 'SCALE') {
      style[start] = percent(before / room)
      style[axis] = percent(node[axis] / room)
    } else {
      style[start] = length(before)
    }
  }
}
