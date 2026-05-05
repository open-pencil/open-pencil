import { BLACK } from '#core/constants'
import type { Color } from '#core/types'

export function normalizeColor(color?: Partial<Color>): Color {
  if (!color) return { ...BLACK }
  return { r: color.r ?? 0, g: color.g ?? 0, b: color.b ?? 0, a: color.a ?? 1 }
}
