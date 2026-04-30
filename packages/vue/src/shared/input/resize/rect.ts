import type { HandlePosition } from '#vue/shared/input/types'
import type { Rect } from '@open-pencil/core/types'

export function constrainToAspectRatio(
  handle: HandlePosition,
  origRect: Rect,
  width: number,
  height: number,
  dx: number,
  dy: number
): Rect {
  let x = handle.includes('w') ? origRect.x + origRect.width - Math.abs(width) : origRect.x
  const isTop = handle === 'nw' || handle === 'n' || handle === 'ne'
  let y = isTop ? origRect.y + origRect.height - Math.abs(height) : origRect.y
  const aspect = origRect.width / origRect.height

  if (handle === 'n' || handle === 's') {
    width = Math.abs(height) * aspect
    x = origRect.x + (origRect.width - width) / 2
  } else if (handle === 'e' || handle === 'w') {
    height = Math.abs(width) / aspect
    y = origRect.y + (origRect.height - height) / 2
  } else if (Math.abs(dx) > Math.abs(dy)) {
    height = (Math.abs(width) / aspect) * Math.sign(height || 1)
    if (isTop) y = origRect.y + origRect.height - Math.abs(height)
  } else {
    width = Math.abs(height) * aspect * Math.sign(width || 1)
    if (handle.includes('w')) x = origRect.x + origRect.width - Math.abs(width)
  }

  return { x, y, width, height }
}

export function calculateResizeRect(
  handle: HandlePosition,
  origRect: Rect,
  dx: number,
  dy: number,
  constrain: boolean
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

  if (constrain && origRect.width > 0 && origRect.height > 0) {
    ;({ x, y, width, height } = constrainToAspectRatio(handle, origRect, width, height, dx, dy))
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
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(Math.max(1, width)),
    height: Math.round(Math.max(1, height))
  }
}
