import type { Paint, ParagraphBuilder, TextStyle } from '@open-pencil/canvaskit'
import type { CharacterStyleOverride } from '@open-pencil/scene-graph'

export interface ParagraphBuildOptions {
  halfLeading?: boolean
  foregroundPaint?: Paint
  /**
   * The paint a style run's characters draw in instead of the layer's, or undefined to keep the
   * layer's: a run with fills of its own draws them apart from the layer's fills.
   */
  rangePaint?: (style: CharacterStyleOverride) => Paint | undefined
}

export interface ParagraphPaintStyle {
  foreground: Paint
  background: Paint
}

export function pushParagraphStyle(
  builder: ParagraphBuilder,
  style: TextStyle,
  paints?: ParagraphPaintStyle
): void {
  if (paints) builder.pushPaintStyle(style, paints.foreground, paints.background)
  else builder.pushStyle(style)
}
