import type { Color } from '@open-pencil/scene-graph'
import { compositeOver, contrastRatio } from '@open-pencil/scene-graph/color'

import { BLACK } from '#core/constants'

const WHITE: Color = { r: 1, g: 1, b: 1, a: 1 }

export function canvasLabelForeground(background: Color, canvasBackground: Color = WHITE): Color {
  const composited = compositeOver(background, canvasBackground)
  return contrastRatio(composited, BLACK) >= contrastRatio(composited, WHITE) ? BLACK : WHITE
}
