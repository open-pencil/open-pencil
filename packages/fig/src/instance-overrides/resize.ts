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

const IDENTITY: Matrix = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }

interface FreeformChild {
  child: InstanceOccurrence
  size: Vector
  transform: Matrix
}

function freeformChildren(parent: InstanceOccurrence): FreeformChild[] {
  const autoLayout = parent.properties.stackMode && parent.properties.stackMode !== 'NONE'
  const children: FreeformChild[] = []
  for (const child of parent.children) {
    const { size, transform, stackPositioning } = child.properties
    if (size && (!autoLayout || stackPositioning === 'ABSOLUTE')) {
      children.push({ child, size, transform: transform ?? IDENTITY })
    }
  }
  return children
}

function sameSize(a: Vector, b: Vector): boolean {
  return a.x === b.x && a.y === b.y
}

export function parentResized(placement: PlacementBeforeResize): boolean {
  const parentSize = placement.parent.properties.size
  return parentSize !== undefined && !sameSize(parentSize, placement.parentSize)
}

function recordPlacements(
  parent: InstanceOccurrence,
  parentSize: Vector,
  placements: PlacementsBeforeResize
): void {
  for (const { child, size, transform } of freeformChildren(parent)) {
    placements.set(child, { parent, parentSize, size, transform })
    recordPlacements(child, size, placements)
  }
}

/** Apply freeform resize constraints in occurrence coordinates before saved derived bounds. */
export function resizeFreeformOccurrence(
  root: InstanceOccurrence,
  before: Vector,
  after: Vector,
  placements: PlacementsBeforeResize
): void {
  if (sameSize(before, after)) {
    return
  }
  for (const { child, size: original, transform } of freeformChildren(root)) {
    const props = child.properties
    const x = constrainedAxis(
      transform.m02,
      original.x,
      before.x,
      after.x,
      props.horizontalConstraint
    )
    const y = constrainedAxis(
      transform.m12,
      original.y,
      before.y,
      after.y,
      props.verticalConstraint
    )
    const size = { x: x.size, y: y.size }
    if (sameSize(original, size)) {
      recordPlacements(child, original, placements)
    } else {
      resizeFreeformOccurrence(child, original, size, placements)
    }
    if (props.type === 'VECTOR' && original.x > 0 && original.y > 0) {
      growInheritedOutlineScale(child, size.x / original.x, size.y / original.y)
    }
    placements.set(child, { parent: root, parentSize: before, size: original, transform })
    props.size = size
    props.transform = { ...transform, m02: x.position, m12: y.position }
  }
}
