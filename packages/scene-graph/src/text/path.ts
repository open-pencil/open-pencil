import type { SceneNode } from '../types'

export function followsPath(
  node: Pick<SceneNode, 'derivedTextGlyphs' | 'textPathData' | 'textPathBox'>
): boolean {
  const glyphs = node.derivedTextGlyphs ?? []
  if (glyphs.length === 0) {
    return false
  }
  return (
    !!node.textPathData || !!node.textPathBox || glyphs.some((glyph) => (glyph.rotation ?? 0) !== 0)
  )
}
