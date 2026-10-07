import type { ConstraintType, SceneNode } from '@open-pencil/scene-graph'

const CONSTRAINT_VALUES: Record<string, ConstraintType> = {
  min: 'MIN',
  center: 'CENTER',
  max: 'MAX',
  stretch: 'STRETCH',
  scale: 'SCALE'
}

const MASK_TYPES: Record<string, SceneNode['maskType']> = {
  alpha: 'ALPHA',
  luminance: 'LUMINANCE',
  vector: 'VECTOR'
}

function constraintValue(value: unknown): ConstraintType | undefined {
  return typeof value === 'string' ? CONSTRAINT_VALUES[value.toLowerCase()] : undefined
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

  if (props.mask) {
    o.isMask = true
    o.maskType = (typeof props.mask === 'string' && MASK_TYPES[props.mask]) || 'ALPHA'
  }
}
