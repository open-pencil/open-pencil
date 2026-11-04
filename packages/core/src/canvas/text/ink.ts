import type { CanvasKit } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'
import { unionVisualBounds, type VisualBounds } from '@open-pencil/scene-graph/geometry'

import { laidOutDecoratedGlyphs } from '#core/canvas/text/decorations'
import type { TextLayout } from '#core/canvas/text/layout'
import { appendOutlineCommand } from '#core/canvas/text/outline-path'
import { laidOutGlyphs } from '#core/canvas/text/placed'
import { shownText } from '#core/text/case'
import { hasDecoration, textDecorationRects } from '#core/text/decorations'
import type { GlyphOutlineSource } from '#core/text/font/glyphs'

/** Each font's glyph outline bounds by glyph and size, `null` for a glyph that draws nothing. */
const glyphBounds = new WeakMap<GlyphOutlineSource, Map<string, VisualBounds | null>>()

function outlineBounds(
  ck: CanvasKit,
  source: GlyphOutlineSource,
  id: number,
  fontSize: number
): VisualBounds | null {
  let bySize = glyphBounds.get(source)
  if (!bySize) {
    bySize = new Map()
    glyphBounds.set(source, bySize)
  }
  const key = `${id}:${fontSize}`
  if (bySize.has(key)) return bySize.get(key) ?? null
  let bounds: VisualBounds | null = null
  const commands = source.outline(id, fontSize)
  if (commands?.length) {
    const builder = new ck.PathBuilder()
    for (const command of commands) appendOutlineCommand(builder, command, 0, 0)
    const path = builder.detachAndDelete()
    const [minX, minY, maxX, maxY] = path.computeTightBounds()
    path.delete()
    if (maxX > minX && maxY > minY) bounds = { minX, minY, maxX, maxY }
  }
  bySize.set(key, bounds)
  return bounds
}

/**
 * Where a laid-out text's glyphs draw ink when drawn `offsetY` below its top, in its own axes:
 * each glyph's outline bounds on the whole pixel its baseline is drawn on, list markers, underlines,
 * and strikethroughs included, as Figma's render bounds take a text (Figma desktop 126). `null` when it draws no glyph, and
 * `undefined` when a glyph's font, and so its outline, is not known.
 */
export function textInkBounds(
  ck: CanvasKit,
  node: SceneNode,
  layout: TextLayout,
  offsetY: number
): VisualBounds | null | undefined {
  const glyphs = laidOutGlyphs(node, layout, shownText(node), offsetY)
  if (!glyphs) return undefined
  let ink: VisualBounds | null = null
  for (const glyph of glyphs) {
    if (!glyph.source) return undefined
    const bounds = outlineBounds(ck, glyph.source, glyph.id, glyph.fontSize)
    if (!bounds) continue
    const x = glyph.x
    const y = Math.round(glyph.y)
    ink = unionVisualBounds(ink, {
      minX: bounds.minX + x,
      minY: bounds.minY + y,
      maxX: bounds.maxX + x,
      maxY: bounds.maxY + y
    })
  }
  if (!hasDecoration(node)) return ink
  for (const rect of textDecorationRects(node, laidOutDecoratedGlyphs(glyphs))) {
    ink = unionVisualBounds(ink, {
      minX: rect.x,
      minY: rect.y,
      maxX: rect.x + rect.width,
      maxY: rect.y + rect.height
    })
  }
  return ink
}
