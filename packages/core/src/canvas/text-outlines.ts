import type { Path } from 'canvaskit-wasm'

import type { SceneNode } from '#core/scene-graph'
import type { OutlineCommand } from '#core/text/opentype'
import { textNodeToOutlineLayout } from '#core/text/outlines'

import type { SkiaRenderer } from './renderer'

function appendOutlineCommand(
  path: Path,
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

export function textNodeToOutlinePath(r: SkiaRenderer, node: SceneNode): Path | null {
  const layout = textNodeToOutlineLayout(node)
  if (!layout) return null

  const path = new r.ck.Path()
  for (const glyph of layout.glyphs) {
    for (const command of glyph.commands) appendOutlineCommand(path, command, glyph.x, glyph.y)
  }
  return path
}
