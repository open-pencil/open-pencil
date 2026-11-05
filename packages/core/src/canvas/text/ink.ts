import type { DerivedTextGlyph, SceneNode } from '@open-pencil/scene-graph'
import {
  geometryBlobBounds,
  unionVisualBounds,
  type VisualBounds
} from '@open-pencil/scene-graph/geometry'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { decorationInk, laidOutDecoratedGlyphs } from '#core/canvas/text/decorations'
import { hasRotatedDerivedGlyphs, snapDerivedGlyphBaseline } from '#core/canvas/text/derived'
import { emojiSquare } from '#core/canvas/text/emoji'
import type { TextLayout } from '#core/canvas/text/layout'
import { drawnBaseline } from '#core/canvas/text/layout/lines'
import { laidOutGlyphs } from '#core/canvas/text/placed'
import { shownText } from '#core/text/case'
import { characterFamily } from '#core/text/character-face'
import {
  hasDecoration,
  savedTextDecorationRects,
  textDecorationRects
} from '#core/text/decorations'
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

const savedGlyphInks = new WeakMap<readonly DerivedTextGlyph[], VisualBounds | null>()

/**
 * A saved glyph's outline where `applyGlyphTransform` and the em scale draw it. Each corner is
 * mapped on its own, so a glyph turned along a path or flipped by a negative scale keeps its
 * bounds the right way round.
 */
function placedGlyphInk(glyph: DerivedTextGlyph, baseline: number): VisualBounds | null {
  const outline = geometryBlobBounds([glyph])
  if (!outline) {
    return null
  }
  const angle = -(glyph.rotation ?? 0)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const scaleX = glyph.scaleX ?? 1
  const scaleY = glyph.scaleY ?? 1
  let ink: VisualBounds | null = null
  for (const emX of [outline.x, outline.x + outline.width]) {
    for (const emY of [outline.y, outline.y + outline.height]) {
      const x = emX * glyph.fontSize
      const y = -emY * glyph.fontSize
      const placedX = glyph.x + (x * cos - y * sin) * scaleX
      const placedY = baseline + (x * sin + y * cos) * scaleY
      ink = unionVisualBounds(ink, { minX: placedX, minY: placedY, maxX: placedX, maxY: placedY })
    }
  }
  return ink
}

function savedOutlinesInk(
  glyphs: readonly DerivedTextGlyph[],
  snapBaselines: boolean
): VisualBounds | null {
  if (savedGlyphInks.has(glyphs)) {
    return savedGlyphInks.get(glyphs) ?? null
  }
  let ink: VisualBounds | null = null
  for (const glyph of glyphs) {
    const baseline = snapBaselines ? snapDerivedGlyphBaseline(glyph.y) : glyph.y
    ink = unionVisualBounds(ink, placedGlyphInk(glyph, baseline))
  }
  savedGlyphInks.set(glyphs, ink)
  return ink
}

/**
 * Where a text drawn from its saved glyphs draws ink, as `drawDerivedText` draws it, in its own
 * axes: each outline where it is placed, and the underline and strikethrough along straight lines.
 */
export function savedTextInk(
  r: Pick<SkiaRenderer, 'textCaches' | 'fontGeneration'>,
  node: SceneNode
): VisualBounds | null {
  const glyphs = node.derivedTextGlyphs ?? []
  const straightLines = !hasRotatedDerivedGlyphs(node)
  let ink = savedOutlinesInk(glyphs, straightLines)
  if (!straightLines || !hasDecoration(node)) {
    return ink
  }
  const rects = savedTextDecorationRects(
    r.textCaches.derivedDecorations,
    node,
    glyphs,
    r.fontGeneration
  )
  for (const rect of rects) {
    ink = unionVisualBounds(ink, decorationInk(rect))
  }
  return ink
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
    const y = drawnBaseline(glyph.y) + glyph.markShift
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
