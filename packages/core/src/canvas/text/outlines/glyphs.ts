import type { Path } from '@open-pencil/canvaskit'
import type { Fill, SceneNode } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { shapeText } from '#core/canvas/text/shape'
import { characterStyles } from '#core/text/character-style'
import { textDecorationRects } from '#core/text/decorations'
import type { OutlineCommand } from '#core/text/font/glyphs'
import { outlineInk } from '#core/text/ink'
import {
  getTextOutlineSupport,
  textNodeToOutlineLayout,
  type TextOutlineGlyph
} from '#core/text/outlines'

import { appendOutlineCommand } from './commands'

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
    outlines.push({ ...glyph, commands: glyph.commands })
  }
  return outlines
}

/** A glyph's outline as a path in the text's box, or null when it draws nothing, as a space. */
function glyphPath(r: SkiaRenderer, commands: OutlineCommand[], x: number, y: number) {
  const path = new r.ck.PathBuilder()
  for (const command of commands) appendOutlineCommand(path, command, x, y)
  const detached = path.detachAndDelete()
  if (!detached.isEmpty()) return detached
  detached.delete()
  return null
}

/** Each glyph the text draws as a path of its own, in the text's box. */
export function textGlyphPaths(r: SkiaRenderer, node: SceneNode): Path[] | null {
  const glyphs = shapedOutlines(r, node) ?? textNodeToOutlineLayout(node)?.glyphs
  if (!glyphs) return null
  return glyphs.flatMap((glyph) => glyphPath(r, glyph.commands, glyph.x, glyph.y) ?? [])
}

/** A path and the paints it is drawn in, as Flatten and Outline stroke take layers apart. */
export interface PaintedPath {
  path: Path
  fills: Fill[]
}

/**
 * What a text draws as Figma's Flatten and Outline stroke take it apart (Figma desktop 126): each
 * glyph in the fills of the character it draws, list markers included, then each underline and
 * strikethrough. Text without a font to outline it from has none.
 */
export function textOutlinePieces(r: SkiaRenderer, node: SceneNode): PaintedPath[] | null {
  const glyphs = shapedOutlines(r, node) ?? textNodeToOutlineLayout(node)?.glyphs
  if (!glyphs) return null
  const styles = characterStyles(node, 0, node.text.length)
  const outlines = glyphs.flatMap((glyph) => {
    const path = glyphPath(r, glyph.commands, glyph.x, glyph.y)
    const style = glyph.firstCharacter === undefined ? undefined : styles[glyph.firstCharacter]
    return path ? [{ path, fills: style?.fills ?? node.fills }] : []
  })
  const decorated = glyphs.map((glyph) => ({
    ...glyph,
    ink: (top: number, bottom: number) => outlineInk(glyph.commands, glyph.x, glyph.y, top, bottom)
  }))
  const decorations = textDecorationRects(node, decorated).map((rect) => {
    const path = new r.ck.PathBuilder()
    path.addRect(r.ck.XYWHRect(rect.x, rect.y, rect.width, rect.height))
    return { path: path.detachAndDelete(), fills: rect.fills }
  })
  return [...outlines, ...decorations]
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
