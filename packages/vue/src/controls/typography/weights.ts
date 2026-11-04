import { FONT_WEIGHT_NAMES } from '@open-pencil/scene-graph/font-style'

/** The standard weights by value, Thin 100 to Black 900, named as Figma names them. */
export const TYPOGRAPHY_WEIGHTS = Object.entries(FONT_WEIGHT_NAMES).map(([value, label]) => ({
  value: Number(value),
  label
}))
