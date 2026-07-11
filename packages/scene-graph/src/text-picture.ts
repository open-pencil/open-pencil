/** Keys that invalidate cached Skia text pictures (layout box included). */
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
 * Keys that invalidate Figma-derived glyph outlines. Width/height are excluded:
 * geometric resize scales path-text glyphs/strokeGeometry in place — clearing
 * them on box size change drops path text and falls back to Paragraph (garbled).
 */
export const TEXT_DERIVED_GLYPH_INVALIDATION_KEYS: ReadonlySet<string> = new Set([
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
  'fills'
])
