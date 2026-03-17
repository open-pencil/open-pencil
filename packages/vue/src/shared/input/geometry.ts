import { CORNER_ROTATE_ZONE, HANDLE_HIT_RADIUS } from '@open-pencil/core'
import type { Vector } from '@open-pencil/core'

import type { CornerPosition, HandlePosition } from './types'

import rotateCursorSvg from '../assets/rotate-cursor.svg?raw'

export const HANDLE_CURSORS: Record<HandlePosition, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize'
}

export function getScreenRect(
  absX: number,
  absY: number,
  w: number,
  h: number,
  zoom: number,
  panX: number,
  panY: number
) {
  return {
    x1: absX * zoom + panX,
    y1: absY * zoom + panY,
    x2: (absX + w) * zoom + panX,
    y2: (absY + h) * zoom + panY
  }
}

export function getHandlePositions(
  absX: number,
  absY: number,
  w: number,
  h: number,
  zoom: number,
  panX: number,
  panY: number
) {
  const { x1, y1, x2, y2 } = getScreenRect(absX, absY, w, h, zoom, panX, panY)
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2

  return {
    nw: { x: x1, y: y1 },
    n: { x: mx, y: y1 },
    ne: { x: x2, y: y1 },
    e: { x: x2, y: my },
    se: { x: x2, y: y2 },
    s: { x: mx, y: y2 },
    sw: { x: x1, y: y2 },
    w: { x: x1, y: my }
  } satisfies Record<HandlePosition, Vector>
}

export function unrotate(
  sx: number,
  sy: number,
  centerX: number,
  centerY: number,
  rotation: number
): { sx: number; sy: number } {
  if (rotation === 0) return { sx, sy }
  const rad = (-rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = sx - centerX
  const dy = sy - centerY
  return {
    sx: centerX + dx * cos - dy * sin,
    sy: centerY + dx * sin + dy * cos
  }
}

export function hitTestHandle(
  sx: number,
  sy: number,
  absX: number,
  absY: number,
  w: number,
  h: number,
  zoom: number,
  panX: number,
  panY: number,
  rotation = 0
): HandlePosition | null {
  const { x1, y1, x2, y2 } = getScreenRect(absX, absY, w, h, zoom, panX, panY)
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const ur = unrotate(sx, sy, cx, cy, rotation)

  const handles = getHandlePositions(absX, absY, w, h, zoom, panX, panY)
  for (const [pos, pt] of Object.entries(handles)) {
    if (Math.abs(ur.sx - pt.x) < HANDLE_HIT_RADIUS && Math.abs(ur.sy - pt.y) < HANDLE_HIT_RADIUS) {
      return pos as HandlePosition
    }
  }
  return null
}

export function hitTestCornerRotation(
  sx: number,
  sy: number,
  absX: number,
  absY: number,
  w: number,
  h: number,
  zoom: number,
  panX: number,
  panY: number,
  rotation = 0
): CornerPosition | null {
  const { x1, y1, x2, y2 } = getScreenRect(absX, absY, w, h, zoom, panX, panY)
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const ur = unrotate(sx, sy, cx, cy, rotation)

  const corners: Array<{ pos: CornerPosition; x: number; y: number }> = [
    { pos: 'nw', x: x1, y: y1 },
    { pos: 'ne', x: x2, y: y1 },
    { pos: 'se', x: x2, y: y2 },
    { pos: 'sw', x: x1, y: y2 }
  ]

  for (const { pos, x, y } of corners) {
    const dx = Math.abs(ur.sx - x)
    const dy = Math.abs(ur.sy - y)
    if (
      dx <= CORNER_ROTATE_ZONE &&
      dy <= CORNER_ROTATE_ZONE &&
      (dx > HANDLE_HIT_RADIUS || dy > HANDLE_HIT_RADIUS)
    ) {
      return pos
    }
  }
  return null
}

const CORNER_BASE_ANGLES: Record<CornerPosition, number> = { nw: 0, ne: 90, se: 180, sw: 270 }

const rotationCursorCache = new Map<number, string>()

export function buildRotationCursor(angleDeg: number): string {
  const key = Math.round(angleDeg) % 360
  let cached = rotationCursorCache.get(key)
  if (cached) return cached
  let svg: string
  if (key === 0) {
    svg = rotateCursorSvg
  } else {
    svg = rotateCursorSvg
      .replace(
        '<path',
        `<g transform='translate(1002 2110) rotate(${key}) translate(-1002 -2110)'><path`
      )
      .replace('</svg>', '</g></svg>')
  }
  cached = `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, auto`
  rotationCursorCache.set(key, cached)
  return cached
}

export function cornerRotationCursor(corner: CornerPosition, nodeRotation = 0): string {
  return buildRotationCursor(CORNER_BASE_ANGLES[corner] + nodeRotation)
}
