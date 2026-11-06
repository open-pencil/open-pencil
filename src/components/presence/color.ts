import { colorToCSS, darkenForContrast } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

/**
 * A person's color for white text drawn on it, such as their avatar's initials or the follow
 * frame's label. People's colors range from pale to deep, so theirs is darkened just enough for
 * the text to read at WCAG AA, keeping its hue. A peer's color can arrive with alpha; what it
 * fills is drawn opaque, so the contrast holds over anything behind it.
 */
export function personFill(color: Color): string {
  const fill = darkenForContrast({ ...color, a: 1 })
  // CSS draws whole 8-bit channels; rounding one up could take the contrast just under the
  // ratio, while rounding down only darkens it further.
  const channel = (value: number) => Math.floor(value * 255) / 255
  return colorToCSS({ r: channel(fill.r), g: channel(fill.g), b: channel(fill.b), a: 1 })
}
