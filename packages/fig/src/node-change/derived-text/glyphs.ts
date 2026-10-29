import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { DerivedTextGlyph } from '@open-pencil/scene-graph'

type DerivedTextData = NonNullable<NodeChange['derivedTextData']>

/**
 * OpenPencil wrote text it had no glyphs for as one unwrapped line at `y = lineHeight`, with a
 * character offset map one entry longer than the text. Figma's map has one entry per character,
 * and later OpenPencil writers follow it, so that length together with every glyph on the one
 * written baseline identifies glyphs that were never laid out at the node's width (#914).
 */
function isUnshapedOpenPencilText(derivedTextData: DerivedTextData, characters: string): boolean {
  const baselines = derivedTextData.baselines ?? []
  if (derivedTextData.logicalIndexToCharacterOffsetMap?.length !== characters.length + 1) {
    return false
  }
  if (baselines.length !== 1) return false
  const baselineY = baselines[0].position.y
  return (derivedTextData.glyphs ?? []).every(
    (glyph) => (glyph.rotation ?? 0) === 0 && glyph.position.y === baselineY
  )
}

/**
 * Resolve Figma derivedTextData.glyphs into scene glyphs.
 * Dropping `rotation` used to flatten path text to axis-aligned scribbles;
 * units are radians (schema `float`, DomeSticker values ≈ -1.75…-0.5).
 */
type EmojiGlyphFields = Pick<DerivedTextGlyph, 'emojiCodePoints' | 'emojiImageSet'>

/**
 * An emoji glyph's code points and image set, copied, for a glyph read or saved; nothing for any
 * other glyph. Figma draws an emoji glyph's placeholder square without them.
 */
export function emojiGlyphFields(glyph: {
  emojiCodePoints?: readonly number[]
  emojiImageSet?: string
}): EmojiGlyphFields {
  if (!glyph.emojiCodePoints?.length) return {}
  const fields: EmojiGlyphFields = { emojiCodePoints: [...glyph.emojiCodePoints] }
  if (glyph.emojiImageSet === 'NOTO') fields.emojiImageSet = 'NOTO'
  return fields
}

export function convertFigmaDerivedTextGlyphs(
  derivedTextData: NodeChange['derivedTextData'],
  blobs: Uint8Array[],
  characters: string
): DerivedTextGlyph[] {
  if (!derivedTextData || isUnshapedOpenPencilText(derivedTextData, characters)) return []
  const glyphs: DerivedTextGlyph[] = []
  // Truncated text is laid out whole, with an ellipsis glyph where it is cut; Figma hides the
  // glyphs from `truncationStartIndex` on, so they are not drawn here either.
  const truncation = derivedTextData.truncationStartIndex ?? -1
  const saved = derivedTextData.glyphs ?? []
  for (const glyph of truncation >= 0 ? saved.slice(0, truncation) : saved) {
    const commandsBlob = glyph.commandsBlob === undefined ? undefined : blobs[glyph.commandsBlob]
    // Layout written without outlines, or with some missing, would draw text with gaps.
    if (!commandsBlob) return []
    // Kiwi stores the advance in ems; files that omit it leave decorations to the layer width.
    const advance = glyph.advance * glyph.fontSize
    glyphs.push({
      commandsBlob,
      x: glyph.position.x,
      y: glyph.position.y,
      fontSize: glyph.fontSize,
      firstCharacter: glyph.firstCharacter,
      rotation: glyph.rotation,
      advance: Number.isFinite(advance) ? advance : undefined,
      ...emojiGlyphFields(glyph)
    })
  }
  return glyphs
}
