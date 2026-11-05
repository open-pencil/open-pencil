import type { SceneNode } from '@open-pencil/scene-graph'
import { unionVisualBounds, type VisualBounds } from '@open-pencil/scene-graph/geometry'

import { decorationInk, laidOutDecoratedGlyphs } from '#core/canvas/text/decorations'
import { emojiSquare } from '#core/canvas/text/emoji'
import type { TextLayout } from '#core/canvas/text/layout'
import { drawnBaseline } from '#core/canvas/text/layout/lines'
import { laidOutGlyphs } from '#core/canvas/text/placed'
import { shownText } from '#core/text/case'
import { characterFamily } from '#core/text/character-face'
import { hasDecoration, textDecorationRects } from '#core/text/decorations'
import { EMOJI_METRICS_FAMILY, mayHoldEmoji } from '#core/text/emoji'
import { nextGraphemeBoundary } from '#core/text/graphemes'
import { COMBINING_KEYCAP, keycapFrameBounds } from '#core/text/keycap'

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
  node: SceneNode,
  layout: TextLayout,
  offsetY: number
): VisualBounds | null | undefined {
  const text = shownText(node)
  const glyphs = laidOutGlyphs(node, layout, text, offsetY)
  // Most text holds neither, and asking each glyph's face would cost more than its outline.
  const keycaps = text.includes(COMBINING_KEYCAP)
  const emoji = mayHoldEmoji(text)
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
    const outline = glyph.source.extents(glyph.id, glyph.fontSize)
    if (outline) add(moved(outline, x, y))
    if (character === undefined) continue
    // A keycap's frame and an emoji's image draw where its glyph stands, as their drawing does.
    if (keycaps && text[character] === COMBINING_KEYCAP) {
      add(moved(keycapFrameBounds(glyph.fontSize), x, y))
    } else if (
      emoji &&
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
