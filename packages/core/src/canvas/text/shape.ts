import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import type { ShapedText, ShapedTextGlyph } from '@open-pencil/fig/node-change'
import type { SceneNode } from '@open-pencil/scene-graph'

import { buildParagraph, textVerticalOffset } from '#core/canvas/text'
import { laidOutGlyphs, type LaidOutGlyph } from '#core/canvas/text/placed'
import { shownText } from '#core/text/case'
import { characterFamily } from '#core/text/character-face'
import { EMOJI_METRICS_FAMILY } from '#core/text/emoji'
import type { OutlineCommand } from '#core/text/font/glyphs'
import { nextGraphemeBoundary } from '#core/text/graphemes'
import { COMBINING_KEYCAP, keycapFrame } from '#core/text/keycap'

/**
 * Whether saved glyphs could stand for this text: case changes that alter its length move
 * glyphs off the characters they came from, and path text is placed along its path. Truncated
 * text saves the characters it shows and the ellipsis after them.
 */
function canShape(node: SceneNode, text: string): boolean {
  return node.text.length > 0 && text.length === node.text.length && !node.textPathData
}

/** Characters inside a glyph cluster or without a glyph take the offset of the one before. */
function completeCharacterOffsets(offsets: Array<number | undefined>): number[] {
  let previous = 0
  return offsets.map((offset) => {
    previous = offset ?? previous
    return previous
  })
}

/**
 * The square Figma saves for an emoji, in pixels at `size` with y down: 1 em wide, from 0.07 em
 * below the baseline, closed with a line back to its start as Figma writes it.
 */
function emojiPlaceholder(size: number): OutlineCommand[] {
  const bottom = 0.07 * size
  const top = -0.93 * size
  return [
    { type: 'M', x: 0, y: bottom },
    { type: 'L', x: size, y: bottom },
    { type: 'L', x: size, y: top },
    { type: 'L', x: 0, y: top },
    { type: 'L', x: 0, y: bottom },
    { type: 'Z' }
  ]
}

interface SavedEmoji {
  codePoints: number[]
  /** Where the emoji's characters end in the text. */
  end: number
}

/**
 * The emoji a glyph starts, as Figma saves it, when the layout gave it to the emoji metrics font:
 * its code points, an emoji that shows as text by default with the selector that asks for its
 * emoji form, as Figma saves ☺ as ☺️.
 */
function savedEmoji(node: SceneNode, text: string, glyph: LaidOutGlyph): SavedEmoji | undefined {
  const start = glyph.firstCharacter
  if (start === undefined || characterFamily(node, text, start) !== EMOJI_METRICS_FAMILY)
    return undefined
  const end = nextGraphemeBoundary(text, start)
  const emoji = text.slice(start, end)
  const codePoints = Array.from(emoji, (character) => character.codePointAt(0) ?? 0)
  if (codePoints.length === 1 && !/\p{Emoji_Presentation}/u.test(emoji)) codePoints.push(0xfe0f)
  return { codePoints, end }
}

/**
 * A glyph's saved outline: an emoji's placeholder, nothing inside one, a keycap's frame, or its
 * font's outline.
 */
function savedOutline(
  glyph: LaidOutGlyph,
  text: string,
  emoji: SavedEmoji | undefined,
  insideEmoji: boolean
): OutlineCommand[] | null {
  if (insideEmoji) return []
  if (emoji) return emojiPlaceholder(glyph.fontSize)
  const character = glyph.firstCharacter
  if (character !== undefined && text[character] === COMBINING_KEYCAP)
    return keycapFrame(glyph.fontSize)
  return glyph.source?.outline(glyph.id, glyph.fontSize) ?? null
}

/**
 * Lay a text node out as the renderer draws it and pair each shaped glyph with the outline of
 * the glyph ID CanvasKit chose, so ligatures and contextual forms keep their shapes. An emoji the
 * layout gives the emoji metrics font is saved as Figma saves one: a placeholder square with its
 * code points. When a run's font cannot be told, no glyph gets an outline: the layout still
 * stands and OpenPencil lays the text out again on reading, but Figma draws it blank.
 * Returns `null` for text saved glyphs cannot represent at all.
 */
export function shapeText(
  ck: CanvasKit,
  fontProvider: TypefaceFontProvider,
  node: SceneNode
): ShapedText | null {
  const text = shownText(node)
  if (!canShape(node, text)) return null

  const paragraph = buildParagraph({ ck, fontProvider, fontsLoaded: true }, node, undefined, {
    halfLeading: true
  })
  try {
    const offsetY = textVerticalOffset(node, paragraph.getHeight())
    const placed = laidOutGlyphs(node, paragraph, text, offsetY)
    if (!placed) return null
    const metrics = paragraph.getLineMetrics()
    const characterOffsets: Array<number | undefined> = Array.from({ length: text.length })
    // A sequence the font does not join is several glyphs: the first stands for the emoji, and
    // the rest keep their place and draw nothing. Glyphs come in visual order, so in
    // right-to-left text a character before the emoji can follow it: the whole range counts.
    let emojiRange = { start: 0, end: 0 }
    const glyphs: ShapedTextGlyph[] = placed.map((glyph) => {
      const start = glyph.firstCharacter
      if (start !== undefined) characterOffsets[start] ??= glyph.x - glyph.lineLeft
      const insideEmoji = start !== undefined && start > emojiRange.start && start < emojiRange.end
      const emoji = insideEmoji ? undefined : savedEmoji(node, text, glyph)
      if (emoji && start !== undefined) emojiRange = { start, end: emoji.end }
      return {
        commands: savedOutline(glyph, text, emoji, insideEmoji),
        x: glyph.x,
        y: glyph.y,
        fontSize: glyph.fontSize,
        firstCharacter: start,
        advance: glyph.advance,
        emojiCodePoints: emoji?.codePoints
      }
    })
    // Outlines from some runs only would draw the text with characters missing.
    const outlined = glyphs.every((glyph) => glyph.commands)
    return {
      glyphs: outlined ? glyphs : glyphs.map((glyph) => ({ ...glyph, commands: null })),
      baselines: metrics.map((line) => ({
        firstCharacter: line.startIndex,
        endCharacter: Math.min(line.endIncludingNewline, text.length),
        position: { x: line.left, y: line.baseline + offsetY },
        width: line.width,
        lineY: line.baseline - line.ascent + offsetY,
        lineHeight: line.height,
        lineAscent: line.ascent
      })),
      logicalIndexToCharacterOffsetMap: completeCharacterOffsets(characterOffsets)
    }
  } finally {
    paragraph.delete()
  }
}
