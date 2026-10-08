import { WHITE, type Color } from '@open-pencil/scene-graph'
import { compositeOver, readableForeground } from '@open-pencil/scene-graph/color'

export function canvasLabelForeground(background: Color, canvasBackground: Color = WHITE): Color {
  return readableForeground(compositeOver(background, canvasBackground))
}
