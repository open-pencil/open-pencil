import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { layerRotates } from '@open-pencil/scene-graph/generated'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import Matrix from '@open-pencil/scene-graph/matrix'
import { slotPropertyId } from '@open-pencil/scene-graph/slots'

import { drawSelectionLabels } from '#core/canvas/labels/selection'
import { drawConnectorHover, drawConnectorSelection } from '#core/canvas/overlays/connectors'
import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'
import { strokeNodeShape } from '#core/canvas/strokes'
import {
  HANDLE_HALF_SIZE,
  ROTATION_HANDLE_DISTANCE,
  CODE_FOCUS_FILL_ALPHA,
  PARENT_OUTLINE_ALPHA,
  PARENT_OUTLINE_DASH,
  SELECTION_DASH_ALPHA
} from '#core/constants'
import {
  createSceneGeometry,
  hasTransformHandles,
  isLineLike,
  viewportMatrix,
  selectionPath,
  rotationHandleLayout,
  type RotationHandleLayout,
  type RotationPreview
} from '#core/geometry'
import { pointAtArc, textPathStartArc } from '#core/text/path'

import {
  inNodeSpace,
  outlineHoveredNode,
  outlineNode,
  type ScreenStroke,
  withScreenStroke
} from './outline'

/** The dash of faint selection bounds, in screen pixels. */
const SELECTION_DASH = [4, 4] as const

export function drawHoverHighlight(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  hoveredNodeId?: string | null,
  preview?: RotationPreview | null
): void {
  const node = hoveredNodeId ? graph.getNode(hoveredNodeId) : undefined
  if (!node) return
  if (node.type === 'CONNECTOR') drawConnectorHover(r, canvas, graph, node, preview)
  else outlineHoveredNode(r, canvas, graph, node, preview)
}

/**
 * The layer of the code element around the cursor: the hover outline over a light tint, so it
 * reads apart from canvas hover (outline only) and selection (outline and handles).
 */
export function drawCodeFocus(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  nodeId?: string | null,
  preview?: RotationPreview | null
): void {
  const node = nodeId ? graph.getNode(nodeId) : undefined
  if (!node) return
  const component = r.isComponentType(node.type)
  r.auxFill.setColor(
    component ? r.compColor(CODE_FOCUS_FILL_ALPHA) : r.selColor(CODE_FOCUS_FILL_ALPHA)
  )
  const color = component ? r.compColor() : r.selColor()
  inNodeSpace(r, canvas, r.sceneGeometry(graph, preview), node, () => {
    strokeNodeShape(r, canvas, node, r.auxFill)
    withScreenStroke(r, { color }, (paint) => strokeNodeShape(r, canvas, node, paint))
  })
}

export function drawEnteredContainer(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  enteredContainerId?: string | null,
  preview?: RotationPreview | null
): void {
  const stroke = { color: r.selColor(SELECTION_DASH_ALPHA), dash: SELECTION_DASH }
  outlineNode(r, canvas, graph, enteredContainerId, stroke, preview)
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
  // text keeps its path and start point, as in Figma; the text-edit overlay
  // outlines the lettering and draws the caret and selection along the path.
  if (editing && !isPathText) return

  r.selectionPaint.setColor(r.outlineColor(node, graph))
  r.selectionPaint.setStrokeWidth(1 / r.zoom)

  const rotation = node.rotation
  if (node.type === 'CONNECTOR') {
    // While its label is typed into, FigJam shows only the label's box.
    const label = overlays.editingTextId ? graph.getNode(overlays.editingTextId) : undefined
    if (label?.parentId !== node.id) drawConnectorSelection(r, canvas, graph, node, preview)
  } else if (isPathText) {
    drawTextPathSelection(r, canvas, node, rotation, graph, editing, preview)
    if (!editing) drawSelectionLabels(r, canvas, graph, selectedIds, overlays)
  } else {
    drawNodeSelection(r, canvas, node, rotation, graph, preview)
    drawSelectionLabels(r, canvas, graph, selectedIds, overlays)
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

  drawParentFrameOutlines(r, canvas, graph, selectedIds, preview)

  if (selectedIds.size === 1) {
    const id = [...selectedIds][0]
    if (nodeEditId !== id) drawSingleSelection(r, canvas, graph, id, selectedIds, overlays)
    return
  }

  for (const id of selectedIds) {
    if (nodeEditId === id) continue
    const node = graph.getNode(id)
    if (!node) continue

    r.selectionPaint.setColor(r.outlineColor(node, graph))
    r.selectionPaint.setStrokeWidth(1 / r.zoom)

    const rotation = node.rotation
    drawNodeOutline(r, canvas, node, rotation, graph, preview)
  }

  r.selectionPaint.setColor(r.selColor())
  r.selectionPaint.setStrokeWidth(1)

  const nodes = [...selectedIds]
    .filter((id) => id !== nodeEditId)
    .map((id) => graph.getNode(id))
    .filter((n): n is SceneNode => n !== undefined)
  if (nodes.length === 0) return
  drawGroupBounds(r, canvas, nodes, graph, preview)

  drawSelectionLabels(r, canvas, graph, selectedIds, overlays)
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
 * ~4%-off textPathBox. While its text is edited only the path and start marker
 * stay, as in Figma. Display-only — reads retained data, mutates nothing.
 */
function drawTextPathSelection(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rotation: number,
  graph: SceneGraph,
  editing: boolean,
  preview?: RotationPreview | null
): void {
  const pathGeometry = selectionPath(node)
  if (!pathGeometry) {
    drawNodeSelection(r, canvas, node, rotation, graph, preview)
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
      // While editing, the text-edit overlay outlines the lettering instead.
      if (!editing) {
        // Faint dashed bounds + resize/rotate handles from the fitted path box.
        withScreenStroke(
          r,
          { color: r.selColor(SELECTION_DASH_ALPHA), dash: SELECTION_DASH },
          (paint) =>
            canvas.drawRect(
              r.ck.LTRBRect(box.x, box.y, box.x + box.width, box.y + box.height),
              paint
            )
        )
        drawBoundsHandles(
          r,
          canvas,
          box.x,
          box.y,
          box.x + box.width,
          box.y + box.height,
          rotationHandleLayout(node, r.sceneGeometry(graph, preview), r.zoom, {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height
          })
        )
      }

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

      if (!editing) {
        // Center crosshair at the fitted path box center (screen-constant size).
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2
        const arm = (HANDLE_HALF_SIZE * 2) / r.zoom
        canvas.drawLine(cx - arm, cy, cx + arm, cy, r.selectionPaint)
        canvas.drawLine(cx, cy - arm, cx, cy + arm, r.selectionPaint)
      }

      // Start-point marker where aligned text is laid out from.
      // forward only flips travel direction, which the display-only marker ignores.
      const start = pointAtArc(sampled, textPathStartArc(data, sampled))
      drawHandle(r, canvas, start.x, start.y)
    },
    preview
  )
}

/**
 * Figma's corner handles and our rotation stalk, absent for a layer that does not turn; a layer
 * too small for handles, or in a read-only document, shows none.
 */
function drawBoundsHandles(
  r: SkiaRenderer,
  canvas: Canvas,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  stalk: RotationHandleLayout | null
): void {
  if (!r.editHandles || !hasTransformHandles((maxX - minX) * r.zoom, (maxY - minY) * r.zoom)) return
  drawHandle(r, canvas, minX, minY)
  drawHandle(r, canvas, maxX, minY)
  drawHandle(r, canvas, minX, maxY)
  drawHandle(r, canvas, maxX, maxY)
  if (!stalk) return
  canvas.drawLine(stalk.edge.x, stalk.edge.y, stalk.handle.x, stalk.handle.y, r.selectionPaint)
  drawHandle(r, canvas, stalk.handle.x, stalk.handle.y)
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
        // A generated frame such as a sticky note may stay upright, and a line turns by its ends.
        !layerRotates(node) || isLineLike(node)
          ? null
          : rotationHandleLayout(node, r.sceneGeometry(graph, preview), r.zoom, {
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
    // Slots get their own dashed outline (overlays/slots.ts).
    if (slotPropertyId(parent)) continue

    const grandparent = parent.parentId ? graph.getNode(parent.parentId) : null
    if (!grandparent || grandparent.type === 'CANVAS') continue

    drawn.add(parent.id)
    outlineNode(r, canvas, graph, parent.id, parentOutline(r), preview)
  }
}

/** The dashed outline of a selected layer's parent, in the selection colour, faded. */
function parentOutline(r: SkiaRenderer): ScreenStroke {
  return {
    color: r.selColor(PARENT_OUTLINE_ALPHA),
    dash: [PARENT_OUTLINE_DASH, PARENT_OUTLINE_DASH]
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
  const geometry = r.sceneGeometry(graph, preview)
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
  if (!hasTransformHandles(maxX - minX, maxY - minY)) return
  drawHandleScreenSpace(r, canvas, minX, minY)
  drawHandleScreenSpace(r, canvas, maxX, minY)
  drawHandleScreenSpace(r, canvas, minX, maxY)
  drawHandleScreenSpace(r, canvas, maxX, maxY)
  const midX = (minX + maxX) / 2
  const rotationHandleY = minY - ROTATION_HANDLE_DISTANCE
  canvas.drawLine(midX, minY, midX, rotationHandleY, r.selectionPaint)
  drawHandleScreenSpace(r, canvas, midX, rotationHandleY)
}
