import resizeCursorSvg from '#vue/shared/assets/resize-cursor.svg?raw'
import rotateCursorSvg from '#vue/shared/assets/rotate-cursor.svg?raw'

import { getAbsoluteRotation, getWorldHandles } from '@open-pencil/core/canvas'
import { CORNER_ROTATE_ZONE, HANDLE_HIT_RADIUS } from '@open-pencil/core/constants'
import { degToRad } from '@open-pencil/core/geometry'

import type { CornerPosition, HandlePosition } from '#vue/shared/input/types'
import type { Editor } from '@open-pencil/core/editor'
import type { SceneGraph, SceneNode } from '@open-pencil/core/scene-graph'
import type { Vector } from '@open-pencil/core/types'

export function getPointerCoords(
  e: MouseEvent,
  canvas: HTMLCanvasElement | null,
  editor: Editor
) {
  if (!canvas) return { sx: 0, sy: 0, cx: 0, cy: 0 }
  const rect = canvas.getBoundingClientRect()
  const sx = e.clientX - rect.left
  const sy = e.clientY - rect.top
  const { x: cx, y: cy } = editor.screenToCanvas(sx, sy)
  return { sx, sy, cx, cy }
}

export function canvasToLocalPoint(
  cx: number,
  cy: number,
  scopeId: string,
  editor: Editor
): { lx: number; ly: number } {
  const node = editor.graph.getNode(scopeId)
  if (!node) return { lx: cx, ly: cy }
  const abs = editor.graph.getAbsolutePosition(scopeId)
  let dx = cx - abs.x
  let dy = cy - abs.y
  if (node.rotation !== 0) {
    const hw = node.width / 2
    const hh = node.height / 2
    const rad = degToRad(-node.rotation)
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const rx = dx - hw
    const ry = dy - hh
    dx = rx * cos - ry * sin + hw
    dy = rx * sin + ry * cos + hh
  }
  return { lx: dx, ly: dy }
}

export function hitTestInEditorScope(
  cx: number,
  cy: number,
  deep: boolean,
  editor: Editor,
  canvasToLocal: (cx: number, cy: number, scopeId: string) => { lx: number; ly: number }
): SceneNode | null {
  const scopeId = editor.state.enteredContainerId

  const renderer = editor.renderer
  if (!renderer) return null
  if (scopeId) {
    if (!editor.graph.getNode(scopeId)) {
      editor.state.enteredContainerId = null
    } else {
      const { lx, ly } = canvasToLocal(cx, cy, scopeId)
      return deep ? editor.graph.hitTestDeep(lx, ly, scopeId) : editor.graph.hitTest(lx, ly, scopeId)
    }
  }
  return deep
    ? editor.graph.hitTestDeep(cx, cy, editor.state.currentPageId)
    : editor.graph.hitTest(cx, cy, editor.state.currentPageId)
}

export function isInsideEditorContainerBounds(
  cx: number,
  cy: number,
  containerId: string,
  editor: Editor,
  canvasToLocal: (cx: number, cy: number, scopeId: string) => { lx: number; ly: number }
): boolean {
  const container = editor.graph.getNode(containerId)
  if (!container) return false
  const { lx, ly } = canvasToLocal(cx, cy, containerId)
  return lx >= 0 && lx <= container.width && ly >= 0 && ly <= container.height
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

  const corners: Array<{ key: CornerPosition; p: Vector }> = [
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

  const svg = resizeCursorSvg
    .replace(
      '<path',
      `<g transform='translate(512 512) rotate(${normalized}) translate(-512 -512)'><path`
    )
    .replace('</svg>', '</g></svg>')
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, auto`
}
