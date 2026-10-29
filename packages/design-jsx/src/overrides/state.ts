import { CONSTRAINT, MASK_TYPE } from '#design-jsx/enums'

import type { ConstraintType, SceneNode } from '@open-pencil/scene-graph'

function constraintValue(value: unknown): ConstraintType | undefined {
  return CONSTRAINT.parse(value)
}

/** The `constraints` prop, shaped like Figma's `constraints` object. */
interface ConstraintsValue {
  horizontal?: unknown
  vertical?: unknown
}

function isConstraintsValue(value: unknown): value is ConstraintsValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function applyConstraints(value: unknown, o: Partial<SceneNode>): void {
  if (!isConstraintsValue(value)) return
  const h = constraintValue(value.horizontal)
  const v = constraintValue(value.vertical)
  if (h) o.horizontalConstraint = h
  if (v) o.verticalConstraint = v
}

function sizeLimit(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * Visibility, locking, mask, constraint, and size-limit props. Constraints follow Figma's
 * `constraints` object with its values in lowercase, as `blendMode` is.
 */
export function applyStateOverrides(props: Record<string, unknown>, o: Partial<SceneNode>): void {
  if (typeof props.visible === 'boolean') o.visible = props.visible
  if (typeof props.locked === 'boolean') o.locked = props.locked
  applyConstraints(props.constraints, o)

  const minWidth = sizeLimit(props.minW)
  const maxWidth = sizeLimit(props.maxW)
  const minHeight = sizeLimit(props.minH)
  const maxHeight = sizeLimit(props.maxH)
  if (minWidth !== undefined) o.minWidth = minWidth
  if (maxWidth !== undefined) o.maxWidth = maxWidth
  if (minHeight !== undefined) o.minHeight = minHeight
  if (maxHeight !== undefined) o.maxHeight = maxHeight

  // `mask` alone masks by alpha; an unknown mask type leaves the layer as it was.
  const maskType = props.mask === true ? 'ALPHA' : MASK_TYPE.parse(props.mask)
  if (maskType) {
    o.isMask = true
    o.maskType = maskType
  }
}
