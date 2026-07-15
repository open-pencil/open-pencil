import type { SceneNode } from './types'

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
 * `fontVariations` and `fontFeatures` are included because they affect glyph
 * outlines and advances, and are not updated during import propagation.
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
  'textDirection',
  'fontVariations',
  'fontFeatures'
])

/**
 * Nulls figmaDerivedTextGlyphs when glyph-affecting properties change,
 * unless the same update explicitly provides new glyphs (import pipeline).
 */
export function invalidateGlyphsIfNeeded(
  node: Pick<SceneNode, 'figmaDerivedTextGlyphs'>,
  changes: Partial<SceneNode>
): void {
  if (!node.figmaDerivedTextGlyphs) return
  if (!Object.keys(changes).some((k) => GLYPH_AFFECTING_KEYS.has(k))) return
  if (changes.figmaDerivedTextGlyphs !== undefined) return
  node.figmaDerivedTextGlyphs = null
}

/**
 * Nulls `textPicture` when text-picture-affecting properties change, then
 * delegates to `invalidateGlyphsIfNeeded` for glyph-vector invalidation.
 * Extracted to share between `SceneGraph.updateNode` and `updateNodePreview`.
 */
export function invalidateTextPictureIfNeeded(
  node: Pick<SceneNode, 'textPicture' | 'figmaDerivedTextGlyphs'>,
  changes: Partial<SceneNode>
): void {
  const textChanged = Object.keys(changes).some((k) => TEXT_PICTURE_KEYS.has(k))
  if (textChanged) node.textPicture = null
  invalidateGlyphsIfNeeded(node, changes)
}
