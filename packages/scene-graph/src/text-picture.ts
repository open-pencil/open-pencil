export const TEXT_PICTURE_KEYS: ReadonlySet<string> = new Set([
  'text',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'italic',
  'textAlignHorizontal',
  'textDirection',
  'textAlignVertical',
  'lineHeight',
  'letterSpacing',
  'textDecoration',
  'textCase',
  'styleRuns',
  'fills',
  'width',
  'height'
])

/**
 * Properties that affect glyph vector shapes or per-glyph positioning.
 * Used to invalidate `figmaDerivedTextGlyphs` — a narrower set than
 * TEXT_PICTURE_KEYS because fills, height, width, and decoration do not
 * change glyph outlines.
 *
 * `width` is excluded because it is updated alongside figmaDerivedTextGlyphs
 * during import propagation (propagateResolvedTextClones) and DSD layout
 * application (applyDerivedSymbolData). Including it would null glyphs that
 * were already computed for the target width. User-initiated width changes
 * that affect text wrapping are handled by the text editing pipeline.
 *
 * Alignment and direction are included because they affect per-glyph absolute
 * positions and are not updated during import propagation.
 */
export const GLYPH_AFFECTING_KEYS: ReadonlySet<string> = new Set([
  'text',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'italic',
  'lineHeight',
  'letterSpacing',
  'textCase',
  'styleRuns',
  'textAlignHorizontal',
  'textAlignVertical',
  'textDirection'
])

/**
 * Nulls figmaDerivedTextGlyphs when glyph-affecting properties change,
 * unless the same update explicitly provides new glyphs (import pipeline).
 */
export function invalidateGlyphsIfNeeded(
  node: { figmaDerivedTextGlyphs: unknown[] | null },
  changes: object
): void {
  if (!node.figmaDerivedTextGlyphs) return
  if (!Object.keys(changes).some((k) => GLYPH_AFFECTING_KEYS.has(k))) return
  if ('figmaDerivedTextGlyphs' in changes) return
  node.figmaDerivedTextGlyphs = null
}
