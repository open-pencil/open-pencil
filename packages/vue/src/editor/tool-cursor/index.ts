import type { Tool } from '@open-pencil/core'

import commentCursorSVG from '#vue/shared/assets/cursors/comment.svg?raw'
import handGrabCursorSVG from '#vue/shared/assets/cursors/hand-grab.svg?raw'
import handCursorSVG from '#vue/shared/assets/cursors/hand.svg?raw'
import penCursorSVG from '#vue/shared/assets/cursors/pen.svg?raw'
import pencilCursorSVG from '#vue/shared/assets/cursors/pencil.svg?raw'

function svgCursor(svg: string, x: number, y: number, fallback: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${x} ${y}, ${fallback}`
}

/** The pen nib, pointing at its tip. */
export const PEN_CURSOR = svgCursor(penCursorSVG, 4, 4, 'crosshair')
/** The pencil, pointing at its tip in the lower left. */
const PENCIL_CURSOR = svgCursor(pencilCursorSVG, 4, 20, 'crosshair')
/** A speech bubble whose tail tip places the comment pin. */
const COMMENT_CURSOR = svgCursor(commentCursorSVG, 5, 24, 'crosshair')
/** The open hand of the hand tool. */
const HAND_CURSOR = svgCursor(handCursorSVG, 16, 16, 'grab')
/** The closed hand while a pan drag is held. */
export const HAND_GRAB_CURSOR = svgCursor(handGrabCursorSVG, 16, 16, 'grabbing')

const TOOL_CURSORS: Record<Tool, string> = {
  SELECT: 'default',
  FRAME: 'crosshair',
  SECTION: 'crosshair',
  RECTANGLE: 'crosshair',
  ELLIPSE: 'crosshair',
  LINE: 'crosshair',
  POLYGON: 'crosshair',
  STAR: 'crosshair',
  TEXT: 'text',
  STICKY: 'crosshair',
  SHAPE_WITH_TEXT: 'crosshair',
  CONNECTOR: 'crosshair',
  PEN: PEN_CURSOR,
  PENCIL: PENCIL_CURSOR,
  HAND: HAND_CURSOR,
  COMMENT: COMMENT_CURSOR
}

export function toolCursor(tool: Tool, override?: string | null): string {
  if (override) return override
  return TOOL_CURSORS[tool]
}
