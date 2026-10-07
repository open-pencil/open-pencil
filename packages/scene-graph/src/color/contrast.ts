import { wcagContrast } from 'culori'

import { BLACK, WHITE } from '../constants'
import type { Color } from '../primitives'

/** Opaque color seen when `foreground` at `alpha` is drawn over an opaque `background`. */
export function compositeOver(foreground: Color, background: Color, alpha = foreground.a): Color {
  const mix = (top: number, bottom: number) => top * alpha + bottom * (1 - alpha)
  return {
    r: mix(foreground.r, background.r),
    g: mix(foreground.g, background.g),
    b: mix(foreground.b, background.b),
    a: 1
  }
}

/** WCAG 2 contrast ratio of two colors, from 1 to 21; alpha is ignored, so composite first. */
export function contrastRatio(
  a: Pick<Color, 'r' | 'g' | 'b'>,
  b: Pick<Color, 'r' | 'g' | 'b'>
): number {
  return wcagContrast(
    { mode: 'rgb', r: a.r, g: a.g, b: a.b },
    { mode: 'rgb', r: b.r, g: b.g, b: b.b }
  )
}

/** Black or white, whichever reads better on an opaque `background`. */
export function readableForeground(background: Pick<Color, 'r' | 'g' | 'b'>): Color {
  return contrastRatio(background, BLACK) >= contrastRatio(background, WHITE) ? BLACK : WHITE
}
