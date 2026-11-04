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

/**
 * `background` darkened just enough for light `text` to reach `ratio` on it, by scaling its
 * channels toward black, which keeps its hue; returned as it is when the text already does.
 * The default is white text at WCAG AA's 4.5:1 for normal text.
 */
export function darkenForContrast(
  background: Color,
  text: Pick<Color, 'r' | 'g' | 'b'> = WHITE,
  ratio = 4.5
): Color {
  if (contrastRatio(background, text) >= ratio) return background
  const scaled = (factor: number): Color => ({
    ...background,
    r: background.r * factor,
    g: background.g * factor,
    b: background.b * factor
  })
  // Darker always contrasts more with light text, so the smallest darkening is found by halving.
  let enough = 0
  let short = 1
  for (let step = 0; step < 20; step++) {
    const middle = (enough + short) / 2
    if (contrastRatio(scaled(middle), text) >= ratio) enough = middle
    else short = middle
  }
  return scaled(enough)
}

/** Black or white, whichever reads better on an opaque `background`. */
export function readableForeground(background: Pick<Color, 'r' | 'g' | 'b'>): Color {
  return contrastRatio(background, BLACK) >= contrastRatio(background, WHITE) ? BLACK : WHITE
}
