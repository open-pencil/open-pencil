import type { CanvasKit } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'
import { unionVisualBounds, type VisualBounds } from '@open-pencil/scene-graph/geometry'

import { decorationInk, laidOutDecoratedGlyphs } from '#core/canvas/text/decorations'
import { emojiSquare } from '#core/canvas/text/emoji'
import type { TextLayout } from '#core/canvas/text/layout'
import { drawnBaseline } from '#core/canvas/text/layout/lines'
import { appendOutlineCommand } from '#core/canvas/text/outlines/commands'
import { laidOutGlyphs } from '#core/canvas/text/placed'
import { shownText } from '#core/text/case'
import { characterFamily } from '#core/text/character-face'
import { hasDecoration, textDecorationRects } from '#core/text/decorations'
import { EMOJI_METRICS_FAMILY } from '#core/text/emoji'
import type { GlyphOutlineSource, OutlineCommand } from '#core/text/font/glyphs'
import { nextGraphemeBoundary } from '#core/text/graphemes'
import { COMBINING_KEYCAP, keycapFrame } from '#core/text/keycap'

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
  const bounds = commandBounds(ck, source.outline(id, fontSize) ?? [])
  bySize.set(key, bounds)
  return bounds
}

/** The exact bounds of an outline's path, or `null` for one that encloses nothing. */
function commandBounds(ck: CanvasKit, commands: readonly OutlineCommand[]): VisualBounds | null {
  if (commands.length === 0) return null
  const builder = new ck.PathBuilder()
  for (const command of commands) appendOutlineCommand(builder, command, 0, 0)
  const path = builder.detachAndDelete()
  const [minX, minY, maxX, maxY] = path.computeTightBounds()
  path.delete()
  return maxX > minX && maxY > minY ? { minX, minY, maxX, maxY } : null
}

function moved(bounds: VisualBounds, x: number, y: number): VisualBounds {
  return {
    minX: bounds.minX + x,
    minY: bounds.minY + y,
    maxX: bounds.maxX + x,
    maxY: bounds.maxY + y
  }
}

/**
 * Where a laid-out text's glyphs draw ink when drawn `offsetY` below its top, in its own axes:
 * each glyph's outline bounds on the whole pixel its baseline is drawn on, with list markers,
 * underlines, strikethroughs, keycap frames, and emoji squares, as Figma's render bounds take a
 * text (Figma desktop 126). `null` when it draws nothing, and `undefined` when a glyph's font, and
 * so its outline, is not known.
 */
export function textInkBounds(
  ck: CanvasKit,
  node: SceneNode,
  layout: TextLayout,
  offsetY: number
): VisualBounds | null | undefined {
  const text = shownText(node)
  const glyphs = laidOutGlyphs(node, layout, text, offsetY)
  if (!glyphs) return undefined
  let ink: VisualBounds | null = null
  const add = (bounds: VisualBounds | null) => {
    if (bounds) ink = unionVisualBounds(ink, bounds)
  }
  // A sequence the font does not join is several glyphs; its emoji draws once, at its first.
  let emojiUntil = 0
  for (const glyph of glyphs) {
    if (!glyph.source) return undefined
    const x = glyph.x
    const y = drawnBaseline(glyph.y)
    const character = glyph.firstCharacter
    const outline = outlineBounds(ck, glyph.source, glyph.id, glyph.fontSize)
    if (outline) add(moved(outline, x, y))
    if (character === undefined) continue
    // A keycap's frame and an emoji's image draw where its glyph stands, as their drawing does.
    if (text[character] === COMBINING_KEYCAP) {
      const frame = commandBounds(ck, keycapFrame(glyph.fontSize))
      if (frame) add(moved(frame, x, y))
    } else if (
      character >= emojiUntil &&
      characterFamily(node, text, character) === EMOJI_METRICS_FAMILY
    ) {
      emojiUntil = nextGraphemeBoundary(text, character)
      add(moved(emojiSquare(glyph.fontSize), x, y))
    }
  }
  if (!hasDecoration(node)) return ink
  for (const rect of textDecorationRects(node, laidOutDecoratedGlyphs(glyphs))) {
    add(decorationInk(rect))
  }
  return ink
}
