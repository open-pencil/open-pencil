import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  connectorLineEnds,
  connectorRoute,
  connectorSublayers,
  curveMidpoint
} from '@open-pencil/scene-graph/connectors'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import { createSceneGeometry } from './scene'
import type { RotationPreview, ViewportTransform } from './types'

/** Where a connector's line starts and ends on screen, where its end handles sit. */
export function connectorScreenEnds(
  graph: SceneGraph,
  connector: SceneNode,
  viewport: ViewportTransform,
  preview?: RotationPreview | null
): { start: Vector; end: Vector } | null {
  const ends = connectorLineEnds(graph, connector)
  if (!ends) return null
  const { line, start, end } = ends
  const [sx, sy, ex, ey] = Matrix.mapPoints(
    createSceneGeometry(graph, preview).screenMatrix(line, viewport),
    [start.x, start.y, end.x, end.y]
  )
  return { start: { x: sx, y: sy }, end: { x: ex, y: ey } }
}

/** An elbow segment's handle, in screen pixels: a bar along the segment. */
export const CONNECTOR_SEGMENT_HANDLE = { length: 20, thickness: 6 }

/** A handle that drags part of a selected connector's line, on screen. */
export type ConnectorRouteHandle =
  /** An elbow segment's handle, at its middle, dragged across it. */
  | { kind: 'segment'; index: number; at: Vector; vertical: boolean; length: number }
  /** A curve's handle, at its middle, dragged anywhere. */
  | { kind: 'curve'; at: Vector }

/**
 * The handles a selected connector's line is dragged by, as FigJam shows them: one on each
 * segment of an elbow, and one midway along a curve. A straight connector has none.
 */
export function connectorRouteHandles(
  graph: SceneGraph,
  connector: SceneNode,
  viewport: ViewportTransform,
  preview?: RotationPreview | null
): ConnectorRouteHandle[] {
  const { connectorLineType: lineType } = connector
  if (lineType === 'STRAIGHT') return []
  const route = connectorRoute(graph, connector)
  if (!route) return []
  // The route runs in the connector's parent's axes; the connector only moves it.
  const toScreen = Matrix.multiply(
    createSceneGeometry(graph, preview).screenMatrix(connector, viewport),
    Matrix.translated(-connector.x, -connector.y)
  )
  const screen = (point: Vector) => Matrix.mapPoint(toScreen, point)
  if (lineType === 'CURVED') {
    const curve = route.pieces.at(0)
    return curve ? [{ kind: 'curve', at: screen(curveMidpoint(curve)) }] : []
  }
  return route.pieces.flatMap((piece, index) => {
    const from = screen(piece.from)
    const to = screen(piece.to)
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    if (length === 0) return []
    return [
      {
        kind: 'segment' as const,
        index,
        at: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
        vertical: Math.abs(to.x - from.x) < Math.abs(to.y - from.y),
        length
      }
    ]
  })
}

/** Where a connector's label plate is on screen, while it has a label to drag. */
export function connectorScreenLabel(
  graph: SceneGraph,
  connector: SceneNode,
  viewport: ViewportTransform,
  preview?: RotationPreview | null
): Rect | null {
  const parts = connectorSublayers(graph, connector)
  if (!parts || parts.label.text === '' || !parts.labelBackground.visible) return null
  const plate = parts.labelBackground
  const [x0, y0, x1, y1] = Matrix.mapPoints(
    createSceneGeometry(graph, preview).screenMatrix(plate, viewport),
    [0, 0, plate.width, plate.height]
  )
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0)
  }
}
