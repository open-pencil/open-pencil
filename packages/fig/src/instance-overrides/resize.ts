import type { Matrix, Vector } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import type { InstanceOccurrence } from './occurrence/types'
import { growInheritedOutlineScale } from './scale/outline'
import { uniformScaleOf } from './types'

export interface PlacementBeforeResize {
  parent: InstanceOccurrence
  parentSize: Vector
  size: Vector
  transform: Matrix
}

export type PlacementsBeforeResize = Map<InstanceOccurrence, PlacementBeforeResize>

type Axis = 'x' | 'y'

interface AxisSpan {
  start: number
  end: number
}

export function applyPlacedConstraints(
  root: InstanceOccurrence,
  base: InstanceOccurrence | null,
  source: NodeChange
): PlacementsBeforeResize {
  const placements: PlacementsBeforeResize = new Map()
  if (!base?.properties.size || !source.size) {
    return placements
  }
  const scale = uniformScaleOf(source)
  resizeFreeformOccurrence(
    root,
    { x: base.properties.size.x * scale, y: base.properties.size.y * scale },
    source.size,
    placements
  )
  return placements
}

function spanAlong(transform: Matrix, size: Vector, axis: Axis): AxisSpan {
  const across = axis === 'x' ? transform.m00 * size.x : transform.m10 * size.x
  const down = axis === 'x' ? transform.m01 * size.y : transform.m11 * size.y
  return {
    start: Math.min(0, across) + Math.min(0, down),
    end: Math.max(0, across) + Math.max(0, down)
  }
}

function anchoredPosition(
  position: number,
  before: AxisSpan,
  after: AxisSpan,
  parentBefore: number,
  parentAfter: number,
  constraint: string | undefined
): number {
  const delta = parentAfter - parentBefore
  if (constraint === 'SCALE' && parentBefore > 0) {
    return (position + before.start) * (parentAfter / parentBefore) - after.start
  }
  if (constraint === 'MAX') {
    return position + before.end + delta - after.end
  }
  if (constraint === 'CENTER') {
    return position + (before.start + before.end + delta - after.start - after.end) / 2
  }
  return position + before.start - after.start
}

function constrainedAxis(
  position: number,
  size: number,
  before: number,
  after: number,
  constraint: string | undefined
) {
  const delta = after - before
  if (constraint === 'SCALE' && before > 0) {
    const factor = after / before
    return { position: position * factor, size: size * factor }
  }
  if (constraint === 'MAX') return { position: position + delta, size }
  if (constraint === 'CENTER') return { position: position + delta / 2, size }
  if (constraint === 'STRETCH') return { position, size: Math.max(0, size + delta) }
  return { position, size }
}

export function transformForSavedSize(
  layer: InstanceOccurrence,
  placement: PlacementBeforeResize
): Matrix {
  const props = layer.properties
  const savedSize = props.size ?? placement.size
  const parentSize = placement.parent.properties.size ?? placement.parentSize
  const { transform } = placement
  const along = (axis: Axis, constraint: string | undefined) =>
    anchoredPosition(
      axis === 'x' ? transform.m02 : transform.m12,
      spanAlong(transform, placement.size, axis),
      spanAlong(transform, savedSize, axis),
      placement.parentSize[axis],
      parentSize[axis],
      constraint
    )
  return {
    ...transform,
    m02: along('x', props.horizontalConstraint),
    m12: along('y', props.verticalConstraint)
  }
}

/** Apply freeform resize constraints in occurrence coordinates before saved derived bounds. */
export function resizeFreeformOccurrence(
  root: InstanceOccurrence,
  before: Vector,
  after: Vector,
  placements: PlacementsBeforeResize
): void {
  if (before.x === after.x && before.y === after.y) return
  const autoLayout = root.properties.stackMode && root.properties.stackMode !== 'NONE'
  for (const child of root.children) {
    const props = child.properties
    if (autoLayout && props.stackPositioning !== 'ABSOLUTE') continue
    if (!props.size) continue
    const transform = props.transform ?? { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    const x = constrainedAxis(
      transform.m02,
      props.size.x,
      before.x,
      after.x,
      props.horizontalConstraint
    )
    const y = constrainedAxis(
      transform.m12,
      props.size.y,
      before.y,
      after.y,
      props.verticalConstraint
    )
    const size = { x: x.size, y: y.size }
    resizeFreeformOccurrence(child, props.size, size, placements)
    if (props.type === 'VECTOR' && props.size.x > 0 && props.size.y > 0)
      growInheritedOutlineScale(child, size.x / props.size.x, size.y / props.size.y)
    placements.set(child, { parent: root, parentSize: before, size: props.size, transform })
    props.size = size
    props.transform = { ...transform, m02: x.position, m12: y.position }
  }
}
