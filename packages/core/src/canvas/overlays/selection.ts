import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { computeBounds, rotatedCorners } from '@open-pencil/scene-graph/geometry'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'
import {
  HANDLE_HALF_SIZE,
  ROTATION_HANDLE_DISTANCE,
  SELECTION_DASH_ALPHA,
  SECTION_HOVER_STROKE_WIDTH
} from '#core/constants'
import {
  createSceneGeometry,
  viewportMatrix,
  selectionPath,
  rotationHandleLayout,
  type RotationHandleLayout,
  type RotationPreview
} from '#core/geometry'
import { pathTextSelectionBand, pointAtArc } from '#core/text/path'

export function drawHoverHighlight(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  hoveredNodeId?: string | null,
  preview?: RotationPreview | null
): void {
  const node = hoveredNodeId ? graph.getNode(hoveredNodeId) : undefined
  if (!node) return
  r.auxStroke.setStrokeWidth((node.type === 'SECTION' ? SECTION_HOVER_STROKE_WIDTH : 1) / r.zoom)
  r.auxStroke.setColor(r.isComponentType(node.type) ? r.compColor() : r.selColor())
  r.auxStroke.setPathEffect(null)
  canvas.save()
  canvas.concat(createSceneGeometry(graph, preview).screenMatrix(node, r))
  r.strokeNodeShape(canvas, node, r.auxStroke)
  canvas.restore()
}

export function drawEnteredContainer(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  enteredContainerId?: string | null,
  preview?: RotationPreview | null
): void {
  const node = enteredContainerId ? graph.getNode(enteredContainerId) : undefined
  if (!node) return
  const dash = r.ck.PathEffect.MakeDash([4 / r.zoom, 4 / r.zoom], 0)
  r.auxStroke.setStrokeWidth(1 / r.zoom)
  r.auxStroke.setColor(r.selColor(SELECTION_DASH_ALPHA))
  r.auxStroke.setPathEffect(dash)
  canvas.save()
  try {
    canvas.concat(createSceneGeometry(graph, preview).screenMatrix(node, r))
    canvas.drawRect(r.ck.LTRBRect(0, 0, node.width, node.height), r.auxStroke)
  } finally {
    canvas.restore()
    r.auxStroke.setPathEffect(null)
    dash.delete()
  }
}

/** Single-node selection overlay: path-text curve/band for imported TEXT_PATH,
 *  the standard rect+handles otherwise. */
function drawSingleSelection(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  id: string,
  selectedIds: Set<string>,
  overlays: RenderOverlays
): void {
  const node = graph.getNode(id)
  if (!node) return

  const preview = overlays.rotationPreview
  // Imported text-on-path node → path curve overlay. The cheap two-field check
  // is the gate; drawTextPathSelection re-checks the retained data and falls
  // back to the plain rectangle if it can't be sampled.
  const isPathText = node.textPathData !== null && node.textPathBox !== null
  const editing = overlays.editingTextId === id
  // While editing: normal text hands off to the flat text-edit overlay, but path
  // text keeps its path overlay (curved band + path) — its flat text-edit overlay
  // is suppressed (see drawTextEditOverlay) since it can't follow the path.
  if (editing && !isPathText) return

  const useComponentColor = r.isComponentType(node.type)
  r.selectionPaint.setColor(useComponentColor ? r.compColor() : r.selColor())
  r.selectionPaint.setStrokeWidth(1 / r.zoom)

  const rotation = node.rotation
  if (isPathText) {
    drawTextPathSelection(r, canvas, node, rotation, graph, preview)
    if (!editing) r.drawSelectionLabels(canvas, graph, selectedIds, overlays)
  } else {
    r.drawNodeSelection(canvas, node, rotation, graph, preview)
    r.drawSelectionLabels(canvas, graph, selectedIds, overlays)
  }
  r.selectionPaint.setColor(r.selColor())
}

export function drawSelection(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>,
  overlays: RenderOverlays
): void {
  if (selectedIds.size === 0) return
  const nodeEditId = overlays.nodeEditState?.nodeId ?? null
  const preview = overlays.rotationPreview

  r.drawParentFrameOutlines(canvas, graph, selectedIds, preview)

  if (selectedIds.size === 1) {
    const id = [...selectedIds][0]
    if (nodeEditId !== id) drawSingleSelection(r, canvas, graph, id, selectedIds, overlays)
    return
  }

  for (const id of selectedIds) {
    if (nodeEditId === id) continue
    const node = graph.getNode(id)
    if (!node) continue

    const useComponentColor = r.isComponentType(node.type)
    r.selectionPaint.setColor(useComponentColor ? r.compColor() : r.selColor())
    r.selectionPaint.setStrokeWidth(1 / r.zoom)

    const rotation = node.rotation
    r.drawNodeOutline(canvas, node, rotation, graph, preview)
  }

  r.selectionPaint.setColor(r.selColor())
  r.selectionPaint.setStrokeWidth(1)

  const nodes = [...selectedIds]
    .filter((id) => id !== nodeEditId)
    .map((id) => graph.getNode(id))
    .filter((n): n is SceneNode => n !== undefined)
  if (nodes.length === 0) return
  r.drawGroupBounds(canvas, nodes, graph, preview)

  r.drawSelectionLabels(canvas, graph, selectedIds, overlays)
}

function withNodeBounds(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rotation: number,
  graph: SceneGraph,
  draw: (x1: number, y1: number, x2: number, y2: number) => void,
  preview?: RotationPreview | null
): void {
  const worldMatrix = createSceneGeometry(
    graph,
    preview ?? { nodeId: node.id, angle: rotation }
  ).worldMatrix(node)

  canvas.save()
  canvas.translate(r.panX, r.panY)
  canvas.scale(r.zoom, r.zoom)
  canvas.concat(worldMatrix)
  draw(0, 0, node.width, node.height)

  canvas.restore()
}

/**
 * Text-on-path selection overlay: the sampled path curve the lettering
 * follows, a faint dashed box + handles, a center crosshair, and a start marker
 * at `textPathStart`. Bounds come from the glyph-fitted path box (see
 * fitTextPathBoxToGlyphs), so the circle tracks the lettering rather than the
 * ~4%-off textPathBox. Display-only — reads retained data, mutates nothing.
 */
function drawTextPathSelection(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rotation: number,
  graph: SceneGraph,
  preview?: RotationPreview | null
): void {
  const pathGeometry = selectionPath(node)
  if (!pathGeometry) {
    r.drawNodeSelection(canvas, node, rotation, graph, preview)
    return
  }

  const { data, box, sampled } = pathGeometry
  withNodeBounds(
    r,
    canvas,
    node,
    rotation,
    graph,
    () => {
      // Figma-style selection band: a filled ribbon that hugs the lettering along
      // the path (replaces the flat, path-blind text-edit selection rects).
      const bandPoly = pathTextSelectionBand(data, box, node.derivedTextGlyphs, sampled)
      if (bandPoly && bandPoly.length >= 6) {
        const band = new r.ck.PathBuilder()
        band.moveTo(bandPoly[0], bandPoly[1])
        for (let i = 2; i < bandPoly.length; i += 2) band.lineTo(bandPoly[i], bandPoly[i + 1])
        band.close()
        const immutableBand = band.detachAndDelete()
        r.auxFill.setColor(r.selColor(0.16))
        canvas.drawPath(immutableBand, r.auxFill)
        r.auxStroke.setStrokeWidth(1 / r.zoom)
        r.auxStroke.setColor(r.selColor())
        r.auxStroke.setPathEffect(null)
        canvas.drawPath(immutableBand, r.auxStroke)
        immutableBand.delete()
      }

      // Faint dashed bounds + resize/rotate handles from the fitted path box.
      r.auxStroke.setStrokeWidth(1 / r.zoom)
      r.auxStroke.setColor(r.selColor(SELECTION_DASH_ALPHA))
      // MakeDash allocates a WASM PathEffect the JS GC won't reclaim; this runs
      // every repaint while a TEXT_PATH node is selected, so free it explicitly.
      const dash = r.ck.PathEffect.MakeDash([4 / r.zoom, 4 / r.zoom], 0)
      r.auxStroke.setPathEffect(dash)
      canvas.drawRect(
        r.ck.LTRBRect(box.x, box.y, box.x + box.width, box.y + box.height),
        r.auxStroke
      )
      r.auxStroke.setPathEffect(null) // auxStroke is shared — never leave a dash effect on it.
      dash.delete()
      drawBoundsHandles(
        r,
        canvas,
        box.x,
        box.y,
        box.x + box.width,
        box.y + box.height,
        rotationHandleLayout(node, createSceneGeometry(graph, preview), r.zoom, {
          x: box.x,
          y: box.y,
          width: box.x + box.width - box.x,
          height: box.y + box.height - box.y
        })
      )

      // The path curve itself, sampled from the headless path metrics only for drawing.
      const path = new r.ck.PathBuilder()
      const overlaySteps = Math.max(64, Math.min(1024, Math.ceil(sampled.length)))
      const first = pointAtArc(sampled, 0)
      path.moveTo(first.x, first.y)
      for (let index = 1; index <= overlaySteps; index++) {
        const point = pointAtArc(sampled, (sampled.length * index) / overlaySteps)
        path.lineTo(point.x, point.y)
      }
      if (sampled.closed) path.close()
      const immutablePath = path.detachAndDelete()
      canvas.drawPath(immutablePath, r.selectionPaint)
      immutablePath.delete()

      // Center crosshair at the fitted path box center (screen-constant size).
      const cx = box.x + box.width / 2
      const cy = box.y + box.height / 2
      const arm = (HANDLE_HALF_SIZE * 2) / r.zoom
      canvas.drawLine(cx - arm, cy, cx + arm, cy, r.selectionPaint)
      canvas.drawLine(cx, cy - arm, cx, cy + arm, r.selectionPaint)

      // Start-point marker on the curve at textPathStart.tValue (arc fraction).
      // forward only flips travel direction, which the display-only marker ignores.
      const s = Math.min(Math.max(data.tValue, 0), 1) * sampled.length
      const start = pointAtArc(sampled, s)
      drawHandle(r, canvas, start.x, start.y)
    },
    preview
  )
}

function drawBoundsHandles(
  r: SkiaRenderer,
  canvas: Canvas,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  stalk: RotationHandleLayout
): void {
  r.drawHandle(canvas, minX, minY)
  r.drawHandle(canvas, maxX, minY)
  r.drawHandle(canvas, minX, maxY)
  r.drawHandle(canvas, maxX, maxY)
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2
  canvas.drawLine(stalk.edge.x, stalk.edge.y, stalk.handle.x, stalk.handle.y, r.selectionPaint)
  r.drawHandle(canvas, stalk.handle.x, stalk.handle.y)
  r.drawHandle(canvas, midX, minY)
  r.drawHandle(canvas, midX, maxY)
  r.drawHandle(canvas, minX, midY)
  r.drawHandle(canvas, maxX, midY)
}

function drawSelectionRect(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rotation: number,
  graph: SceneGraph,
  afterDraw?: (x1: number, y1: number, x2: number, y2: number) => void,
  preview?: RotationPreview | null
): void {
  withNodeBounds(
    r,
    canvas,
    node,
    rotation,
    graph,
    (x1, y1, x2, y2) => {
      canvas.drawRect(r.ck.LTRBRect(x1, y1, x2, y2), r.selectionPaint)
      afterDraw?.(x1, y1, x2, y2)
    },
    preview
  )
}

export function drawNodeSelection(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rotation: number,
  graph: SceneGraph,
  preview?: RotationPreview | null
): void {
  drawSelectionRect(
    r,
    canvas,
    node,
    rotation,
    graph,
    (x1, y1, x2, y2) => {
      drawBoundsHandles(
        r,
        canvas,
        x1,
        y1,
        x2,
        y2,
        rotationHandleLayout(node, createSceneGeometry(graph, preview), r.zoom, {
          x: x1,
          y: y1,
          width: x2 - x1,
          height: y2 - y1
        })
      )
    },
    preview
  )
}

export function drawParentFrameOutlines(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>,
  preview?: RotationPreview | null
): void {
  const drawn = new Set<string>()
  for (const id of selectedIds) {
    const node = graph.getNode(id)
    if (!node?.parentId) continue

    const parent = graph.getNode(node.parentId)
    if (!parent || parent.type === 'CANVAS') continue
    if (drawn.has(parent.id) || selectedIds.has(parent.id)) continue

    const grandparent = parent.parentId ? graph.getNode(parent.parentId) : null
    if (!grandparent || grandparent.type === 'CANVAS') continue

    drawn.add(parent.id)

    const m = createSceneGeometry(graph, preview).screenMatrix(parent, r)

    const pts = Matrix.mapPoints(m, [
      0,
      0,
      parent.width,
      0,
      parent.width,
      parent.height,
      0,
      parent.height
    ])

    const path = new r.ck.PathBuilder()
    path.moveTo(pts[0], pts[1])
    path.lineTo(pts[2], pts[3])
    path.lineTo(pts[4], pts[5])
    path.lineTo(pts[6], pts[7])
    path.close()

    const immutablePath = path.detachAndDelete()
    canvas.drawPath(immutablePath, r.parentOutlinePaint)
    immutablePath.delete()
  }
}

export function drawNodeOutline(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rotation: number,
  graph: SceneGraph,
  preview?: RotationPreview | null
): void {
  drawSelectionRect(r, canvas, node, rotation, graph, undefined, preview)
}

export function drawGroupBounds(
  r: SkiaRenderer,
  canvas: Canvas,
  nodes: SceneNode[],
  graph: SceneGraph,
  preview?: RotationPreview | null
): void {
  const geometry = createSceneGeometry(graph, preview)
  const bounds = computeBounds(nodes.map(geometry.bounds))
  const [minX, minY, maxX, maxY] = Matrix.mapPoints(viewportMatrix(r), [
    bounds.x,
    bounds.y,
    bounds.x + bounds.width,
    bounds.y + bounds.height
  ])
  r.auxStroke.setStrokeWidth(1)
  r.auxStroke.setColor(r.selColor(SELECTION_DASH_ALPHA))
  r.auxStroke.setPathEffect(null)
  canvas.drawRect(r.ck.LTRBRect(minX, minY, maxX, maxY), r.auxStroke)
  drawBoundsHandlesScreenSpace(r, canvas, minX, minY, maxX, maxY)
}

export function getRotatedCorners(r: SkiaRenderer, n: SceneNode, abs: Vector): Vector[] {
  const cx = (abs.x + n.width / 2) * r.zoom + r.panX
  const cy = (abs.y + n.height / 2) * r.zoom + r.panY
  const hw = (n.width / 2) * r.zoom
  const hh = (n.height / 2) * r.zoom
  return rotatedCorners(cx, cy, hw, hh, n.rotation)
}

export function drawHandle(r: SkiaRenderer, canvas: Canvas, x: number, y: number): void {
  r.auxFill.setColor(r.ck.WHITE)
  const s = HANDLE_HALF_SIZE / r.zoom
  const rect = r.ck.LTRBRect(x - s, y - s, x + s, y + s)
  canvas.drawRect(rect, r.auxFill)
  canvas.drawRect(rect, r.selectionPaint)
}

function drawHandleScreenSpace(r: SkiaRenderer, canvas: Canvas, x: number, y: number): void {
  r.auxFill.setColor(r.ck.WHITE)
  const rect = r.ck.LTRBRect(
    x - HANDLE_HALF_SIZE,
    y - HANDLE_HALF_SIZE,
    x + HANDLE_HALF_SIZE,
    y + HANDLE_HALF_SIZE
  )
  canvas.drawRect(rect, r.auxFill)
  canvas.drawRect(rect, r.selectionPaint)
}

function drawBoundsHandlesScreenSpace(
  r: SkiaRenderer,
  canvas: Canvas,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): void {
  drawHandleScreenSpace(r, canvas, minX, minY)
  drawHandleScreenSpace(r, canvas, maxX, minY)
  drawHandleScreenSpace(r, canvas, minX, maxY)
  drawHandleScreenSpace(r, canvas, maxX, maxY)
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2
  const rotationHandleY = minY - ROTATION_HANDLE_DISTANCE
  canvas.drawLine(midX, minY, midX, rotationHandleY, r.selectionPaint)
  drawHandleScreenSpace(r, canvas, midX, rotationHandleY)
  drawHandleScreenSpace(r, canvas, midX, minY)
  drawHandleScreenSpace(r, canvas, midX, maxY)
  drawHandleScreenSpace(r, canvas, minX, midY)
  drawHandleScreenSpace(r, canvas, maxX, midY)
}
