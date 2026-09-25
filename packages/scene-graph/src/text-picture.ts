import { isEqual } from 'es-toolkit/predicate'

import { TEXT_SHAPING_FIELDS, TEXT_LAYOUT_FIELDS } from './fields/text'
import type { SceneNode } from './types'

/**
 * Invalidate cached Skia textPicture (Paragraph snapshot). Includes width/height
 * because wrapping/layout depends on the box.
 */
export const TEXT_PICTURE_KEYS: ReadonlySet<string> = new Set([
  ...TEXT_SHAPING_FIELDS,
  'textDecoration',
  'fills',
  'width',
  'height'
])

export const GLYPH_AFFECTING_KEYS: ReadonlySet<string> = new Set(TEXT_SHAPING_FIELDS)

/**
 * Shared by SceneGraph.updateNode and updateNodePreview (drag hot path) so the
 * two invalidation rules cannot drift. Glyphs are kept when the caller
 * replaces them in the same update (resize supplies scaled copies).
 */
export function textCacheInvalidationChanges(
  node: SceneNode,
  changes: Partial<SceneNode>
): Partial<SceneNode> {
  const invalidated: Partial<SceneNode> = {}
  const keys = Object.keys(changes).filter(
    (key) => !isEqual(node[key as keyof SceneNode], changes[key as keyof SceneNode])
  )
  if (node.textPicture && keys.some((key) => TEXT_PICTURE_KEYS.has(key)))
    invalidated.textPicture = null
  const glyphsInvalidated =
    keys.some((key) => GLYPH_AFFECTING_KEYS.has(key)) ||
    TEXT_LAYOUT_FIELDS.some((key) => keys.includes(key))
  if (glyphsInvalidated && !('derivedLayout' in changes)) invalidated.derivedLayout = null
  // A successful path-text edit supplies reflowed glyphs in `changes`. Every
  // other mutation path must drop stale baked glyphs and path identity rather
  // than pair new text/style with old visible outlines.
  if (node.derivedTextGlyphs && glyphsInvalidated && !changes.derivedTextGlyphs) {
    // Path-text resize supplies transformed glyphs through the resize workflow. A raw box
    // preview keeps them until that workflow commits or an actual shaping edit occurs.
    const onlyPathBoxResize =
      !!node.textPathData && keys.every((key) => key === 'width' || key === 'height')
    if (!onlyPathBoxResize) {
      invalidated.derivedTextGlyphs = null
      invalidated.textPathData = null
    }
  }
  return invalidated
}

export function invalidateTextCaches(node: SceneNode, changes: Partial<SceneNode>): void {
  Object.assign(node, textCacheInvalidationChanges(node, changes))
}
