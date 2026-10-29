import { FONT_WEIGHT_NAMES } from '@open-pencil/scene-graph/font-style'

export function weightToFigmaStyle(weight: number, italic = false): string {
  const rounded = Math.round(weight / 100) * 100
  const label = FONT_WEIGHT_NAMES[rounded] ?? 'Regular'
  return italic ? `${label} Italic` : label
}
