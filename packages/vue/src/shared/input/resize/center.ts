// Figma's Alt resize: the box grows and shrinks around its center, the side opposite the handle
// mirroring the one dragged. The dragged side keeps where the resize put it, snapped or not.
import type { HandlePosition } from '@open-pencil/core/geometry'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { atLeastOne } from '#vue/shared/input/resize/rect'

interface AxisSpan {
  start: number
  size: number
}

function movesTop(handle: HandlePosition): boolean {
  return handle === 'nw' || handle === 'n' || handle === 'ne'
}

function movesBottom(handle: HandlePosition): boolean {
  return handle === 'sw' || handle === 's' || handle === 'se'
}

function isEdgeHandle(handle: HandlePosition): boolean {
  return handle === 'n' || handle === 's' || handle === 'e' || handle === 'w'
}

/** A span of `size` around `center`; a negative size keeps the box mirrored, as a resize does. */
function around(center: number, size: number): AxisSpan {
  const kept = atLeastOne(size)
  return { start: center - kept / 2, size: kept }
}

/**
 * One axis of the box mirrored around the original center: the side the handle moves keeps the
 * resized position and the opposite side moves as far the other way. An axis the handle leaves
 * keeps the resized span.
 */
function mirroredAxis(
  movesStart: boolean,
  movesEnd: boolean,
  orig: AxisSpan,
  resized: AxisSpan
): AxisSpan {
  const center = orig.start + orig.size / 2
  if (movesEnd) {
    const growth = resized.start + resized.size - (orig.start + orig.size)
    return around(center, orig.size + 2 * growth)
  }

  if (!movesStart) return resized
  const shift = resized.start - orig.start
  return around(center, orig.size - 2 * shift)
}

/**
 * An edge handle kept at `aspect` sizes the other axis from the one it drags, around the center,
 * since that axis grew by the mirrored amount.
 */
function withCenteredCrossAxis(
  handle: HandlePosition,
  orig: Rect,
  rect: Rect,
  aspect: number
): Rect {
  if (handle === 'e' || handle === 'w') {
    const { start, size } = around(orig.y + orig.height / 2, Math.abs(rect.width) / aspect)
    return { ...rect, y: start, height: size }
  }

  const { start, size } = around(orig.x + orig.width / 2, Math.abs(rect.height) * aspect)
  return { ...rect, x: start, width: size }
}

/**
 * The resized box `rect` turned into a resize from the center of `orig`, as Alt does in Figma.
 * Sizes stay signed: a side dragged past the center lands the box mirrored.
 */
export function resizedFromCenter(
  handle: HandlePosition,
  orig: Rect,
  rect: Rect,
  aspect: number | null
): Rect {
  const x = mirroredAxis(
    handle.includes('w'),
    handle.includes('e'),
    { start: orig.x, size: orig.width },
    { start: rect.x, size: rect.width }
  )
  const y = mirroredAxis(
    movesTop(handle),
    movesBottom(handle),
    { start: orig.y, size: orig.height },
    { start: rect.y, size: rect.height }
  )
  const mirrored = { x: x.start, y: y.start, width: x.size, height: y.size }
  if (aspect === null || !isEdgeHandle(handle)) return mirrored

  return withCenteredCrossAxis(handle, orig, mirrored, aspect)
}
