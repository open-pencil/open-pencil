import type { Fill, Variable } from '@open-pencil/scene-graph'
import { colorToHexRaw } from '@open-pencil/scene-graph/color'

export function fillLabel(fill: Fill, boundVariable?: Variable): string {
  if (boundVariable) return boundVariable.name
  if (fill.type === 'SOLID') return colorToHexRaw(fill.color)
  if (fill.type.startsWith('GRADIENT')) return fill.type.replace('GRADIENT_', '')
  return fill.type
}
