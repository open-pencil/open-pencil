import type { HandlePosition } from '@open-pencil/core/geometry'
import type { Rect } from '@open-pencil/scene-graph/primitives'

/** `value` at least `min` long, keeping the direction it was dragged in. */
function atLeast(value: number, min: number): number {
  return Math.sign(value || 1) * Math.max(Math.abs(value), min)
}

export type AspectDriver = 'width' | 'height'

function isEdgeHandle(handle: HandlePosition): boolean {
  return handle === 'n' || handle === 's' || handle === 'e' || handle === 'w'
}

/**
 * The side that sizes a box kept at `aspect`: an edge handle's own axis, or for a corner the axis
 * the pointer changed most, the width when both changed alike, as FigJam picks.
 */
export function aspectDriver(
  handle: HandlePosition,
  width: number,
  height: number,
  aspect: number
): AspectDriver {
  if (isEdgeHandle(handle)) return handle === 'e' || handle === 'w' ? 'width' : 'height'
  return Math.abs(width) >= Math.abs(height) * aspect ? 'width' : 'height'
}

/**
 * Fits a dragged box to `aspect` (width over height), as Figma does: an edge handle sizes the
 * other axis around its centre, a corner handle follows the axis the pointer changed most and
 * keeps the opposite corner in place. The side that drives stays long enough for the other to
 * keep a whole pixel, so the box keeps its ratio at its smallest. `driver` names the side that
 * drives instead, and `follow` adjusts the size the other side gets, such as rounding it.
 */
export function constrainToAspectRatio(
  handle: HandlePosition,
  origRect: Rect,
  width: number,
  height: number,
  aspect: number,
  driver: AspectDriver = aspectDriver(handle, width, height, aspect),
  follow: (size: number) => number = (size) => size
): Rect {
  const minWidth = Math.max(1, aspect)
  const minHeight = Math.max(1, 1 / aspect)
  const isTop = handle === 'nw' || handle === 'n' || handle === 'ne'
  const isEdge = isEdgeHandle(handle)
  if (driver === 'width') {
    width = atLeast(width, minWidth)
    height = follow(Math.abs(width) / aspect) * (isEdge ? 1 : Math.sign(height || 1))
  } else {
    height = atLeast(height, minHeight)
    width = follow(Math.abs(height) * aspect) * (isEdge ? 1 : Math.sign(width || 1))
  }

  // Signed sizes: a handle dragged past the opposite edge lands the box on the far side.
  let x = handle.includes('w') ? origRect.x + origRect.width - width : origRect.x
  let y = isTop ? origRect.y + origRect.height - height : origRect.y
  if (handle === 'n' || handle === 's') x = origRect.x + (origRect.width - width) / 2
  if (handle === 'e' || handle === 'w') y = origRect.y + (origRect.height - height) / 2

  return { x, y, width, height }
}

export function calculateResizeRect(
  handle: HandlePosition,
  origRect: Rect,
  dx: number,
  dy: number,
  aspect: number | null
): Rect {
  let { x, y, width, height } = origRect

  const moveLeft = handle.includes('w')
  const moveRight = handle.includes('e')
  const moveTop = handle === 'nw' || handle === 'n' || handle === 'ne'
  const moveBottom = handle === 'sw' || handle === 's' || handle === 'se'

  if (moveRight) width = origRect.width + dx
  if (moveLeft) {
    x = origRect.x + dx
    width = origRect.width - dx
  }
  if (moveBottom) height = origRect.height + dy
  if (moveTop) {
    y = origRect.y + dy
    height = origRect.height - dy
  }

  if (aspect !== null) {
    ;({ x, y, width, height } = constrainToAspectRatio(handle, origRect, width, height, aspect))
  }

  if (width < 0) {
    x += width
    width = -width
  }
  if (height < 0) {
    y += height
    height = -height
  }

  return {
    x,
    y,
    width: Math.max(1, width),
    height: Math.max(1, height)
  }
}
