import type { Path, PathBuilder } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import type { OutlineCommand } from '#core/text/opentype'
import {
  getTextOutlineSupport,
  textNodeToOutlineLayout,
  type TextOutlineGlyph
} from '#core/text/outlines'

import { shapeText } from './shape'

function appendOutlineCommand(
  path: PathBuilder,
  command: OutlineCommand,
  xOffset: number,
  yOffset: number
): void {
  switch (command.type) {
    case 'M':
      path.moveTo((command.x ?? 0) + xOffset, (command.y ?? 0) + yOffset)
      break
    case 'L':
      path.lineTo((command.x ?? 0) + xOffset, (command.y ?? 0) + yOffset)
      break
    case 'C':
      path.cubicTo(
        (command.x1 ?? 0) + xOffset,
        (command.y1 ?? 0) + yOffset,
        (command.x2 ?? 0) + xOffset,
        (command.y2 ?? 0) + yOffset,
        (command.x ?? 0) + xOffset,
        (command.y ?? 0) + yOffset
      )
      break
    case 'Q':
      path.quadTo(
        (command.x1 ?? 0) + xOffset,
        (command.y1 ?? 0) + yOffset,
        (command.x ?? 0) + xOffset,
        (command.y ?? 0) + yOffset
      )
      break
    case 'Z':
      path.close()
      break
  }
}

/**
 * The glyphs the canvas draws, list markers included, when every one has an outline; text set
 * partly in a fallback or variable font has none and keeps the outline layout's own glyphs.
 */
function shapedOutlines(r: SkiaRenderer, node: SceneNode): TextOutlineGlyph[] | null {
  if (!r.fontProvider || !getTextOutlineSupport(node).supported) return null
  const shaped = shapeText(r.ck, r.fontProvider, node, { decorations: false })
  if (!shaped) return null
  const outlines: TextOutlineGlyph[] = []
  for (const glyph of shaped.glyphs) {
    if (!glyph.commands) return null
    outlines.push({ commands: glyph.commands, x: glyph.x, y: glyph.y })
  }
  return outlines
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
