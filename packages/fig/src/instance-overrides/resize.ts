import type { NodeChange, Vector } from '@open-pencil/kiwi/fig/codec'

import type { InstanceOccurrence } from './interpret'
import { uniformScaleOf } from './types'

export function applyPlacedConstraints(
  root: InstanceOccurrence,
  base: InstanceOccurrence | null,
  source: NodeChange
): void {
  if (!base?.properties.size || !source.size) return
  const scale = uniformScaleOf(source)
  resizeFreeformOccurrence(
    root,
    { x: base.properties.size.x * scale, y: base.properties.size.y * scale },
    source.size
  )
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

/** Apply freeform resize constraints in occurrence coordinates before saved derived bounds. */
export function resizeFreeformOccurrence(
  root: InstanceOccurrence,
  before: Vector,
  after: Vector
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
    resizeFreeformOccurrence(child, props.size, size)
    props.size = size
    props.transform = { ...transform, m02: x.position, m12: y.position }
  }
}
