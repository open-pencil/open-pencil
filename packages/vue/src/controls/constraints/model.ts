import type { ConstraintType } from '@open-pencil/scene-graph'

import type { MIXED } from '#vue/controls/node-props/use'

export type ConstraintAxis = 'horizontal' | 'vertical'
export type ConstraintEdge = 'leading' | 'trailing'
export type ConstraintValue = ConstraintType | typeof MIXED

export function constraintPins(value: ConstraintValue): {
  leading: boolean
  trailing: boolean
  center: boolean
  scale: boolean
} {
  return {
    leading: value === 'MIN' || value === 'STRETCH',
    trailing: value === 'MAX' || value === 'STRETCH',
    center: value === 'CENTER',
    scale: value === 'SCALE'
  }
}

export function toggleConstraintPin(
  value: ConstraintValue,
  edge: ConstraintEdge,
  additive: boolean
): ConstraintType {
  if (!additive) return edge === 'leading' ? 'MIN' : 'MAX'
  const pins = constraintPins(value)
  const leading = edge === 'leading' ? !pins.leading : pins.leading
  const trailing = edge === 'trailing' ? !pins.trailing : pins.trailing
  if (leading && trailing) return 'STRETCH'
  if (leading) return 'MIN'
  if (trailing) return 'MAX'
  return 'CENTER'
}
