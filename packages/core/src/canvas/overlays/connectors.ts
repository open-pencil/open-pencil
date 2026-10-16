import type { Canvas, Paint } from 'canvaskit-wasm'

import { connectorSublayers, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedBoundsInParent } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas/renderer'
import type { ConnectorTarget } from '#core/editor/connectors/attach'
import {
  connectorScreenEnds,
  createSceneGeometry,
  viewportMatrix,
  type RotationPreview
} from '#core/geometry'
import { vectorNetworkToPath } from '#core/vector'

/** Radius of a connector's end handles and of a layer's magnet dots, in screen pixels. */
export const CONNECTOR_HANDLE_RADIUS = 5
const MAGNET_DOT_RADIUS = 4

/** A connector's line traced in screen space with `paint`. */
function strokeConnectorLine(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  connector: SceneNode,
  paint: Paint,
  preview?: RotationPreview | null
) {
  const line = connectorSublayers(graph, connector)?.line
  if (!line?.vectorNetwork) return
  // Traced as drawn, its elbows rounded.
  const paths = vectorNetworkToPath(r.ck, line.vectorNetwork, line.cornerRadius)
  canvas.save()
  canvas.concat(createSceneGeometry(graph, preview).screenMatrix(line, r))
  for (const path of paths) {
    canvas.drawPath(path, paint)
    path.delete()
  }
  canvas.restore()
}

function drawDot(r: SkiaRenderer, canvas: Canvas, point: Vector, radius: number, filled: boolean) {
  r.auxFill.setMaskFilter(null)
  r.auxFill.setColor(filled ? r.selColor() : r.ck.WHITE)
  canvas.drawCircle(point.x, point.y, radius, r.auxFill)
  r.auxStroke.setPathEffect(null)
  r.auxStroke.setStrokeWidth(1)
  r.auxStroke.setColor(r.selColor())
  canvas.drawCircle(point.x, point.y, radius, r.auxStroke)
}

/** A connector's hover outline: its line, not the box around its route. */
export function drawConnectorHover(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  connector: SceneNode,
  preview?: RotationPreview | null
) {
  r.auxStroke.setPathEffect(null)
  r.auxStroke.setColor(r.selColor())
  r.auxStroke.setStrokeWidth(2 / r.zoom)
  strokeConnectorLine(r, canvas, graph, connector, r.auxStroke, preview)
}

/** A selected connector, as FigJam shows it: its line outlined and a handle at each end. */
export function drawConnectorSelection(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  connector: SceneNode,
  preview?: RotationPreview | null
) {
  drawConnectorHover(r, canvas, graph, connector, preview)
  const ends = connectorScreenEnds(graph, connector, r, preview)
  if (!ends) return
  drawDot(r, canvas, ends.start, CONNECTOR_HANDLE_RADIUS, false)
  drawDot(r, canvas, ends.end, CONNECTOR_HANDLE_RADIUS, false)
}

/**
 * The layer a connector end would attach to: its outline and a dot at each side's midpoint, the
 * dot of the side it would take filled.
 */
export function drawConnectorTarget(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  target: ConnectorTarget | null | undefined,
  preview?: RotationPreview | null
) {
  const node = target ? graph.getNode(target.nodeId) : undefined
  if (!target || !node) return
  r.drawHoverHighlight(canvas, graph, node.id, preview)
  const page = graph.pageOf(node.id)
  if (!page) return
  const box = getAxisAlignedBoundsInParent([node], page, graph)
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const sides = [
    ['TOP', cx, box.y],
    ['RIGHT', box.x + box.width, cy],
    ['BOTTOM', cx, box.y + box.height],
    ['LEFT', box.x, cy]
  ] as const
  const screen = Matrix.mapPoints(
    viewportMatrix(r),
    sides.flatMap(([, x, y]) => [x, y])
  )
  sides.forEach(([side], index) => {
    const point = { x: screen[index * 2], y: screen[index * 2 + 1] }
    drawDot(r, canvas, point, MAGNET_DOT_RADIUS, side === target.magnet)
  })
}
