/**
 * Invalidate cached Skia textPicture (Paragraph snapshot). Includes width/height
 * because wrapping/layout depends on the box.
 */
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
 * Invalidate Figma-derived glyph outlines (path text / missing-font paint).
 *
 * Intentionally omits width/height: resize updates the box and *also* scales
 * glyphs via scaledGeometryChanges. If width/height cleared glyphs here, live
 * resize fell through to Paragraph and drew garbled axis-aligned "enen.art"
 * on top of the path (DomeSticker). Content/style keys still wipe glyphs —
 * there is no path-layout reflow engine yet.
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
