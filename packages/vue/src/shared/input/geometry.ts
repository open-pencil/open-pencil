import { HANDLE_HIT_RADIUS, LAYER_HIT_PAD } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'
import {
  createSceneGeometry,
  isLineLike,
  selectionHandleRect,
  hasTransformHandles,
  rotationHandleLayout,
  transformZoneAt,
  type CornerPosition,
  type HandlePosition,
  type SceneGeometry,
  type RotationPreview,
  type TransformZone
} from '@open-pencil/core/geometry'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import moveCursorSVG from '#vue/shared/assets/cursors/move.svg?raw'
import resizeCursorSVG from '#vue/shared/assets/cursors/resize.svg?raw'
import rotateCursorSVG from '#vue/shared/assets/cursors/rotate.svg?raw'

/** Figma's four-way cursor over a handle that moves a point, such as a line's end. */
export const MOVE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(moveCursorSVG)}") 12 12, auto`

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
  const pad = LAYER_HIT_PAD / renderer.zoom
  if (scopeId && !editor.graph.getNode(scopeId)) editor.state.enteredContainerId = null
  const scope = editor.state.enteredContainerId ?? editor.state.currentPageId
  return deep
    ? editor.graph.hitTestDeep(cx, cy, scope, pad)
    : editor.graph.hitTestSelectable(cx, cy, scope, editor.state.selectedIds, pad)
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

/** The resize or rotation zone of a selected layer under a canvas point, in its own frame. */
function transformZoneOf(
  cx: number,
  cy: number,
  node: SceneNode,
  geometry: SceneGeometry,
  zoom: number
): TransformZone | null {
  const pointer = geometry.toLocal(node, { x: cx, y: cy })
  const zone = pointer ? transformZoneAt(pointer, selectionHandleRect(node), zoom) : null
  // A line is aimed by its two end handles, not resized: see `lineEndAt`.
  return zone?.kind === 'resize' && isLineLike(node) ? null : zone
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
  const zone = transformZoneOf(cx, cy, node, geometry, zoom)
  if (zone?.kind !== 'resize') return null
  return { handle: zone.handle, rotation: getCursorAngleFromHandle(zone.handle, node, geometry) }
}

export function hitTestTopRotationHandleByMatrix(
  cx: number,
  cy: number,
  node: SceneNode,
  graph: SceneGraph,
  zoom: number = 1,
  preview?: RotationPreview | null
): boolean {
  const rect = selectionHandleRect(node)
  if (isLineLike(node) || !hasTransformHandles(rect.width * zoom, rect.height * zoom)) return false
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
  const zone = transformZoneOf(cx, cy, node, createSceneGeometry(graph, preview), zoom)
  return zone?.kind === 'rotate' ? zone.corner : null
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
