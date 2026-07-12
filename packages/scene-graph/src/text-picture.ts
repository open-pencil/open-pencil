import type { SceneNode } from './types'

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
export const TEXT_DERIVED_GLYPH_INVALIDATION_KEYS: ReadonlySet<string> = new Set(
  [...TEXT_PICTURE_KEYS].filter((key) => key !== 'width' && key !== 'height')
)

/**
 * Shared by SceneGraph.updateNode and updateNodePreview (drag hot path) so the
 * two invalidation rules cannot drift. Glyphs are kept when the caller
 * replaces them in the same update (resize supplies scaled copies).
 */
export function invalidateTextCaches(node: SceneNode, changes: Partial<SceneNode>): void {
  const keys = Object.keys(changes)
  if (node.textPicture && keys.some((key) => TEXT_PICTURE_KEYS.has(key))) node.textPicture = null
  const glyphsInvalidated = keys.some((key) => TEXT_DERIVED_GLYPH_INVALIDATION_KEYS.has(key))
  if (node.figmaDerivedTextGlyphs && glyphsInvalidated && !changes.figmaDerivedTextGlyphs) {
    node.figmaDerivedTextGlyphs = null
    // Export must not claim TEXT_PATH without baked glyphs.
    if (node.source.fig.kiwiNodeType === 'TEXT_PATH') node.source.fig.kiwiNodeType = null
  }
}
