import { BLACK } from '../constants'
import type { Color } from '../primitives'

export function normalizeColor(color?: Partial<Color>): Color {
  if (!color) return { ...BLACK }
  return { r: color.r ?? 0, g: color.g ?? 0, b: color.b ?? 0, a: color.a ?? 1 }
}
