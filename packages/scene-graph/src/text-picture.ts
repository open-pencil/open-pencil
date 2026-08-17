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
  // A successful path-text edit supplies reflowed glyphs in `changes`. Every
  // other mutation path must drop stale baked glyphs and path identity rather
  // than pair new text/style with old visible outlines.
  if (node.derivedTextGlyphs && glyphsInvalidated && !changes.derivedTextGlyphs) {
    node.derivedTextGlyphs = null
    node.textPathData = null
  }
}
