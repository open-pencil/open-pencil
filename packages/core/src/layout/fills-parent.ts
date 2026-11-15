import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { keepsSavedLayout } from './derived'

/**
 * Whether the sizes children were saved with, with the parent's padding and gaps, add up to the
 * parent's own size on `axis`: then layout keeps them rather than sharing the axis out again.
 */
function sizesFitParent(
  parent: SceneNode,
  childCount: number,
  sizes: Array<number | undefined>,
  axis: 'width' | 'height'
): boolean {
  if (sizes.some((size) => size === undefined)) return false
  const padding =
    axis === 'width'
      ? parent.paddingLeft + parent.paddingRight
      : parent.paddingTop + parent.paddingBottom
  const gap =
    parent.primaryAxisAlign === 'SPACE_BETWEEN'
      ? 0
      : parent.itemSpacing * Math.max(0, childCount - 1)
  const available = axis === 'width' ? parent.width : parent.height
  const total = sizes.reduce<number>((sum, size) => sum + (size ?? 0), padding + gap)
  return Math.abs(total - available) < 0.001
}

/** The children `parent`'s auto layout places: visible and not absolutely positioned. */
function flowChildren(graph: SceneGraph, parent: SceneNode): SceneNode[] {
  return graph
    .getChildren(parent.id)
    .filter((candidate) => candidate.visible && candidate.layoutPositioning !== 'ABSOLUTE')
}

/**
 * Whether the auto layout children of a parent that keeps its saved layout fill its main axis at
 * their saved sizes, `child` among them, so `child` keeps its saved size on `axis`.
 */
export function derivedMainAxisFitsParent(
  graph: SceneGraph,
  parent: SceneNode,
  child: SceneNode,
  axis: 'width' | 'height'
): boolean {
  if (!keepsSavedLayout(graph, parent)) return false
  const children = flowChildren(graph, parent)
  if (children.length === 0) return false

  const sizes = children.map((candidate) => candidate.derivedLayout?.[axis])
  return (
    sizesFitParent(parent, children.length, sizes, axis) &&
    child.derivedLayout?.[axis] !== undefined
  )
}

/**
 * Whether growing text keeps the size it was saved with on its parent's main axis: its saved
 * size, with its siblings', fills the parent.
 */
export function derivedGrowingLeafFitsParent(
  graph: SceneGraph,
  parent: SceneNode,
  child: SceneNode,
  axis: 'width' | 'height'
): boolean {
  if (child.type !== 'TEXT' || child.layoutGrow <= 0 || child.derivedLayout?.[axis] === undefined) {
    return false
  }
  const children = flowChildren(graph, parent)
  const sizes = children.map((candidate) => {
    if (candidate.layoutGrow > 0) return candidate.derivedLayout?.[axis]
    return axis === 'width' ? candidate.width : candidate.height
  })
  return sizesFitParent(parent, children.length, sizes, axis)
}
