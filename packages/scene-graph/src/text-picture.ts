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
 * Properties that change imported glyph outlines or per-glyph positioning.
 *
 * Deliberately narrower than TEXT_PICTURE_KEYS. Width/height resize the box and
 * *also* scale glyphs via scaledGeometryChanges, and fills, alignment and
 * decoration repaint without moving an outline. Clearing glyphs for any of
 * those made live resize fall through to Paragraph and draw garbled
 * axis-aligned text on top of the path (DomeSticker).
 */
export const GLYPH_AFFECTING_KEYS: ReadonlySet<string> = new Set([
  'text',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'italic',
  'textDirection',
  'lineHeight',
  'letterSpacing',
  'textCase',
  'styleRuns'
])

/**
 * Shared by SceneGraph.updateNode and updateNodePreview (drag hot path) so the
 * two invalidation rules cannot drift. Glyphs are kept when the caller
 * replaces them in the same update (resize supplies scaled copies).
 */
export function invalidateTextCaches(node: SceneNode, changes: Partial<SceneNode>): void {
  const keys = Object.keys(changes)
  if (node.textPicture && keys.some((key) => TEXT_PICTURE_KEYS.has(key))) node.textPicture = null
  const glyphsInvalidated = keys.some((key) => GLYPH_AFFECTING_KEYS.has(key))
  // Path text glyphs ARE the layout (placed along textPathBox), not a
  // re-derivable paragraph cache — nulling them destroys the on-path lettering
  // (and its TEXT_PATH identity). A successful path-text edit supplies reflowed
  // glyphs in `changes` (so this is already skipped); when it can't reflow, keep
  // the existing glyphs instead of wiping them.
  if (
    node.figmaDerivedTextGlyphs &&
    glyphsInvalidated &&
    !changes.figmaDerivedTextGlyphs &&
    !node.textPathBox
  ) {
    node.figmaDerivedTextGlyphs = null
    // Export must not claim TEXT_PATH without baked glyphs.
    if (node.source.fig.kiwiNodeType === 'TEXT_PATH') node.source.fig.kiwiNodeType = null
  }
}
