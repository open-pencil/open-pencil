import type { Canvas } from 'canvaskit-wasm'

import type { SceneNode } from '#core/scene-graph'
import { geometryBlobToPath } from '#core/vector'

import type { SkiaRenderer } from './renderer'

export function snapFigmaDerivedGlyphBaseline(y: number): number {
  return Math.round(y)
}

export function shouldUseHardFigmaDerivedGlyphCoverage(
  node: Pick<SceneNode, 'fontSize' | 'fontWeight'>
): boolean {
  return node.fontSize === 20 && node.fontWeight === 400
}

export function derivedUnderlineRect(node: Pick<SceneNode, 'width'>, baselineY: number) {
  return {
    x1: 0,
    y1: baselineY + 2.75,
    x2: Math.max(0, node.width - 0.75),
    y2: baselineY + 3.75
  }
}

export function drawFigmaDerivedText(r: SkiaRenderer, canvas: Canvas, node: SceneNode): boolean {
  if (!node.figmaDerivedTextGlyphs?.length) return false

  let underlineBaselineY = 0
  for (const glyph of node.figmaDerivedTextGlyphs) {
    underlineBaselineY = Math.max(underlineBaselineY, snapFigmaDerivedGlyphBaseline(glyph.y))
    const path = geometryBlobToPath(r.ck, glyph.commandsBlob, 'NONZERO')
    canvas.save()
    canvas.translate(glyph.x, snapFigmaDerivedGlyphBaseline(glyph.y))
    canvas.scale(glyph.fontSize, -glyph.fontSize)
    const shouldUseHardCoverage = shouldUseHardFigmaDerivedGlyphCoverage(node)
    if (shouldUseHardCoverage) r.fillPaint.setAntiAlias(false)
    canvas.drawPath(path, r.fillPaint)
    if (shouldUseHardCoverage) r.fillPaint.setAntiAlias(true)
    canvas.restore()
    path.delete()
  }

  if (node.textDecoration === 'UNDERLINE') {
    const rect = derivedUnderlineRect(node, underlineBaselineY)
    canvas.drawRect(r.ltrb(rect.x1, rect.y1, rect.x2, rect.y2), r.fillPaint)
  }
  return true
}
