import {
  CORNER_ROTATE_ZONE,
  getAbsoluteRotation,
  getWorldHandles,
  HANDLE_HIT_RADIUS
} from '@open-pencil/core'

import resizeCursorSvg from '../assets/resize-cursor.svg?raw'
import rotateCursorSvg from '../assets/rotate-cursor.svg?raw'

import type { CornerPosition, HandlePosition } from './types'
import type { Vector, SceneGraph, SceneNode } from '@open-pencil/core'

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

function getCursorAngleFromHandle(handle: HandlePosition, rotation: number): number {
  const map: Record<HandlePosition, [number, number]> = {
    nw: [1, 1],
    ne: [-1, 1],
    se: [-1, -1],
    sw: [1, -1],

    n: [0, 1],
    e: [1, 0],
    s: [0, -1],
    w: [-1, 0]
  }

  const [bx, by] = map[handle]

  const baseAngle = (Math.atan2(by, bx) * 180) / Math.PI

  const angle = baseAngle - rotation

  return (angle + 360) % 360
}

export function getHitHandleByMatrix(
  cx: number,
  cy: number,
  node: SceneNode,
  graph: SceneGraph,
  zoom = 1
): {
  handle: HandlePosition
  rotation: number
} | null {
  const handles = getWorldHandles(node, graph)

  const CORNER_R = HANDLE_HIT_RADIUS / zoom

  const rotation = getAbsoluteRotation(node, graph)
  for (const key in handles) {
    const handleKey = key as HandlePosition
    const p = handles[handleKey]

    if (!p) continue

    const dx = cx - p.x
    const dy = cy - p.y

    if (dx * dx + dy * dy <= CORNER_R * CORNER_R) {
      const angle = getCursorAngleFromHandle(handleKey, rotation)

      return {
        handle: handleKey,
        rotation: angle
      }
    }
  }

  return null
}
export function hitTestCornerRotationByMatrix(
  cx: number,
  cy: number,
  node: SceneNode,
  graph: SceneGraph,
  zoom: number = 1
): CornerPosition | null {
  const handles = getWorldHandles(node, graph)

  const HANDLE_R = HANDLE_HIT_RADIUS / zoom
  const ROTATE_R = CORNER_ROTATE_ZONE / zoom

  const corners: Array<{ key: CornerPosition; p: { x: number; y: number } }> = [
    { key: 'nw', p: handles.nw },
    { key: 'ne', p: handles.ne },
    { key: 'se', p: handles.se },
    { key: 'sw', p: handles.sw }
  ]

  for (const { key, p } of corners) {
    const dx = cx - p.x
    const dy = cy - p.y
    const d = Math.hypot(dx, dy)

    if (d > HANDLE_R && d <= ROTATE_R) {
      switch (key) {
        case 'nw':
          if (dx < 0 && dy < 0) return key
          break
        case 'ne':
          if (dx > 0 && dy < 0) return key
          break
        case 'se':
          if (dx > 0 && dy > 0) return key
          break
        case 'sw':
          if (dx < 0 && dy > 0) return key
          break
      }
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
  return buildRotationCursor(CORNER_BASE_ANGLES[corner] - nodeRotation)
}

export function buildResizeCursor(angleDeg: number): string {
  const normalized = ((Math.round(angleDeg) % 360) + 360) % 360

  let svg = resizeCursorSvg
    .replace(
      '<path',
      `<g transform='translate(512 512) rotate(${normalized}) translate(-512 -512)'><path`
    )
    .replace('</svg>', '</g></svg>')
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, auto`
}
