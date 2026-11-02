import type { Path } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import {
  getTextOutlineSupport,
  textNodeToOutlineLayout,
  type TextOutlineGlyph
} from '#core/text/outlines'

import { appendOutlineCommand } from './outline-path'
import { shapeText } from './shape'

/**
 * The glyphs the canvas draws, list markers included, when every one has an outline; text set
 * partly in a fallback or variable font has none and keeps the outline layout's own glyphs.
 */
function shapedOutlines(r: SkiaRenderer, node: SceneNode): TextOutlineGlyph[] | null {
  if (!r.fontProvider || !getTextOutlineSupport(node).supported) return null
  const shaped = shapeText(r.ck, r.fontProvider, node)
  if (!shaped) return null
  const outlines: TextOutlineGlyph[] = []
  for (const glyph of shaped.glyphs) {
    if (!glyph.commands) return null
    outlines.push({ commands: glyph.commands, x: glyph.x, y: glyph.y })
  }
  return outlines
}

/** Each glyph the text draws as a path of its own, in the text's box. */
export function textGlyphPaths(r: SkiaRenderer, node: SceneNode): Path[] | null {
  const glyphs = shapedOutlines(r, node) ?? textNodeToOutlineLayout(node)?.glyphs
  if (!glyphs) return null
  return glyphs.flatMap((glyph) => {
    const path = new r.ck.PathBuilder()
    for (const command of glyph.commands) appendOutlineCommand(path, command, glyph.x, glyph.y)
    const detached = path.detachAndDelete()
    if (!detached.isEmpty()) return [detached]
    detached.delete()
    return []
  })
}

export function textNodeToOutlinePath(r: SkiaRenderer, node: SceneNode): Path | null {
  const glyphs = shapedOutlines(r, node) ?? textNodeToOutlineLayout(node)?.glyphs
  if (!glyphs) return null

  const path = new r.ck.PathBuilder()
  for (const glyph of glyphs) {
    for (const command of glyph.commands) appendOutlineCommand(path, command, glyph.x, glyph.y)
  }
  return path.detachAndDelete()
}
