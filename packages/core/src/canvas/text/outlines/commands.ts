import type { PathBuilder } from 'canvaskit-wasm'

import type { OutlineCommand } from '#core/text/font/glyphs'

/** Appends an outline command, offset by `xOffset` and `yOffset`, to a path being built. */
export function appendOutlineCommand(
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
