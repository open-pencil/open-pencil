import { CORNER_ROTATE_ZONE, HANDLE_HIT_RADIUS } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'
import {
  createSceneGeometry,
  selectionHandleRect,
  rotationHandleLayout,
  type SceneGeometry,
  type RotationPreview
} from '@open-pencil/core/geometry'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import resizeCursorSVG from '#vue/shared/assets/resize-cursor.svg?raw'
import rotateCursorSVG from '#vue/shared/assets/rotate-cursor.svg?raw'
import type { CornerPosition, HandlePosition } from '#vue/shared/input/types'

export function getPointerCoords(e: MouseEvent, canvas: HTMLCanvasElement | null, editor: Editor) {
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
  const point = node
    ? createSceneGeometry(editor.graph, editor.state.rotationPreview).toLocal(node, {
        x: cx,
        y: cy
      })
    : null
  return { lx: point?.x ?? cx, ly: point?.y ?? cy }
}

export function hitTestInEditorScope(
  cx: number,
  cy: number,
  deep: boolean,
  editor: Editor
): SceneNode | null {
  const scopeId = editor.state.enteredContainerId

  const renderer = editor.renderer
  if (!renderer) return null
  if (scopeId) {
    if (!editor.graph.getNode(scopeId)) {
      editor.state.enteredContainerId = null
    } else {
      return deep
        ? editor.graph.hitTestDeep(cx, cy, scopeId)
        : editor.graph.hitTest(cx, cy, scopeId)
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

function getCursorAngleFromHandle(
  handle: HandlePosition,
  node: SceneNode,
  geometry: SceneGeometry
): number {
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

  const direction = geometry.direction(node, { x: bx, y: by })
  const angle = (Math.atan2(direction.y, direction.x) * 180) / Math.PI

  return (angle + 360) % 360
}

export function getHitHandleByMatrix(
  cx: number,
  cy: number,
  node: SceneNode,
  graph: SceneGraph,
  zoom = 1,
  preview?: RotationPreview | null
): {
  handle: HandlePosition
  rotation: number
} | null {
  const geometry = createSceneGeometry(graph, preview)
  const handles = geometry.handles(node, selectionHandleRect(node))

  const CORNER_R = HANDLE_HIT_RADIUS / zoom
  for (const [key, p] of Object.entries(handles)) {
    const handleKey = key as HandlePosition

    const dx = cx - p.x
    const dy = cy - p.y

    if (dx * dx + dy * dy <= CORNER_R * CORNER_R) {
      const angle = getCursorAngleFromHandle(handleKey, node, geometry)

      return {
        handle: handleKey,
        rotation: angle
      }
    }
  }

  return null
}
export function hitTestTopRotationHandleByMatrix(
  cx: number,
  cy: number,
  node: SceneNode,
  graph: SceneGraph,
  zoom: number = 1,
  preview?: RotationPreview | null
): boolean {
  const geometry = createSceneGeometry(graph, preview)
  const handle = geometry.toWorld(node, rotationHandleLayout(node, geometry, zoom).handle)
  const radius = HANDLE_HIT_RADIUS / zoom
  const dx = cx - handle.x
  const dy = cy - handle.y
  return dx * dx + dy * dy <= radius * radius
}

export function hitTestCornerRotationByMatrix(
  cx: number,
  cy: number,
  node: SceneNode,
  graph: SceneGraph,
  zoom: number = 1,
  preview?: RotationPreview | null
): CornerPosition | null {
  const geometry = createSceneGeometry(graph, preview)
  const handles = geometry.handles(node, selectionHandleRect(node))
  const pointer = geometry.toLocal(node, { x: cx, y: cy })
  if (!pointer) return null

  const HANDLE_R = HANDLE_HIT_RADIUS / zoom
  const ROTATE_R = CORNER_ROTATE_ZONE / zoom

  const corners: Array<{ key: CornerPosition; p: Vector }> = [
    { key: 'nw', p: handles.nw },
    { key: 'ne', p: handles.ne },
    { key: 'se', p: handles.se },
    { key: 'sw', p: handles.sw }
  ]

  for (const { key, p } of corners) {
    const local = geometry.toLocal(node, p)
    if (!local) continue
    const dx = pointer.x - local.x
    const dy = pointer.y - local.y
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

const rotationCursorCache = new Map<number, string>()

export function buildRotationCursor(angleDeg: number): string {
  const key = Math.round(angleDeg) % 360
  let cached = rotationCursorCache.get(key)
  if (cached) return cached
  let svg: string
  if (key === 0) {
    svg = rotateCursorSVG
  } else {
    svg = rotateCursorSVG
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

export function cornerRotationCursor(
  corner: CornerPosition,
  node: SceneNode,
  graph: SceneGraph,
  preview?: RotationPreview | null
): string {
  const direction = createSceneGeometry(graph, preview).direction(node, {
    x: corner === 'nw' || corner === 'sw' ? -1 : 1,
    y: corner === 'nw' || corner === 'ne' ? -1 : 1
  })
  return buildRotationCursor((Math.atan2(direction.y, direction.x) * 180) / Math.PI + 135)
}

export function buildResizeCursor(angleDeg: number): string {
  const normalized = ((Math.round(angleDeg) % 360) + 360) % 360

  const svg = resizeCursorSVG
    .replace(
      '<path',
      `<g transform='translate(512 512) rotate(${normalized}) translate(-512 -512)'><path`
    )
    .replace('</svg>', '</g></svg>')
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, auto`
}
