import { compositeOver, readableForeground } from '@open-pencil/scene-graph/color'
import { WHITE } from '@open-pencil/scene-graph/constants'
import type { Color } from '@open-pencil/scene-graph/primitives'

export function canvasLabelForeground(background: Color, canvasBackground: Color = WHITE): Color {
  return readableForeground(compositeOver(background, canvasBackground))
}
