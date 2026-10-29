import type { SceneNode } from '@open-pencil/scene-graph'
import {
  connectorLabelPositionAt,
  connectorRoute,
  connectorSublayers,
  curveControlPoints,
  dragCurve,
  dragElbowSegment,
  elbowJoints,
  type ConnectorPiece
} from '@open-pencil/scene-graph/connectors'
import { getParentWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import type { NodePreview } from '#core/editor/node-preview'
import type { EditorContext } from '#core/editor/types'

type BeginNodePreview = (label?: string) => NodePreview

const PREVIEW_LABELS: Record<ConnectorLinePart['kind'], string> = {
  segment: 'Move connector segment',
  curve: 'Bend connector',
  label: 'Move connector label'
}

/** What a drag on a connector's line holds: an elbow segment by its index, the curve, or the label. */
export type ConnectorLinePart =
  | { kind: 'segment'; index: number }
  | { kind: 'curve' }
  | { kind: 'label' }

interface LineDrag {
  connectorId: string
  part: ConnectorLinePart
  /** Where the press was, in the connector's parent's axes. */
  press: Vector
  /** The route as the drag found it, in the connector's parent's axes. */
  pieces: ConnectorPiece[]
  joints: [Vector, Vector]
  handles: [Vector, Vector] | null
  /** The label's plate as the drag found it, in the connector's parent's axes. */
  plate: Rect | null
  preview: NodePreview
}

function shifted(point: Vector, by: Vector): Vector {
  return { x: point.x + by.x, y: point.y + by.y }
}

/**
 * Dragging a selected connector's line, as FigJam does: an elbow segment moves across itself, to
 * whole pixels, a curve bends so the point midway along it follows the pointer, and the label
 * slides along the line or off to one side of it. The connector keeps the result, and one undo
 * step puts it back.
 */
export function createConnectorLineActions(ctx: EditorContext, beginNodePreview: BeginNodePreview) {
  let drag: LineDrag | null = null

  /** A canvas point in the connector's parent's axes. */
  function inParent(connector: SceneNode, x: number, y: number): Vector {
    const parent = connector.parentId ? ctx.graph.getNode(connector.parentId) : undefined
    const toParent = Matrix.invert(getParentWorldMatrix(parent, ctx.graph)) ?? Matrix.identity()
    return Matrix.mapPoint(toParent, { x, y })
  }

  function connectorLineBegin(connectorId: string, part: ConnectorLinePart, x: number, y: number) {
    connectorLineCancel()
    const connector = ctx.graph.getNode(connectorId)
    const route = connector ? connectorRoute(ctx.graph, connector) : null
    if (!connector || !route) return
    const curve = route.pieces.at(0)
    const plate = connectorSublayers(ctx.graph, connector)?.labelBackground
    drag = {
      connectorId,
      part,
      press: inParent(connector, x, y),
      pieces: route.pieces,
      joints: elbowJoints(route.start, route.end, route.sides),
      handles: route.controls.curve ?? (curve ? curveControlPoints(curve) : null),
      plate: plate
        ? {
            x: connector.x + plate.x,
            y: connector.y + plate.y,
            width: plate.width,
            height: plate.height
          }
        : null,
      preview: beginNodePreview(PREVIEW_LABELS[part.kind])
    }
  }

  function connectorLineDrag(x: number, y: number) {
    const current = drag
    const connector = current ? ctx.graph.getNode(current.connectorId) : undefined
    if (!current || !connector) return
    const point = inParent(connector, x, y)
    const delta = { x: point.x - current.press.x, y: point.y - current.press.y }
    // Control points sit in the connector's own axes.
    const local = { x: -connector.x, y: -connector.y }
    if (current.part.kind === 'label') {
      if (!current.plate) return
      const { x: px, y: py, width, height } = current.plate
      // The label's centre follows the pointer, wherever the plate was grabbed.
      const centre = { x: px + width / 2 + delta.x, y: py + height / 2 + delta.y }
      const position = connectorLabelPositionAt(current.pieces, { width, height }, centre)
      if (position) current.preview.update(connector.id, { connectorLabelPosition: position })
      return
    }
    if (current.part.kind === 'curve') {
      if (!current.handles) return
      const [first, second] = dragCurve(current.handles, delta)
      current.preview.update(connector.id, {
        connectorCurveHandles: [shifted(first, local), shifted(second, local)]
      })
      return
    }
    const piece = current.pieces.at(current.part.index)
    if (!piece) return
    const vertical = piece.from.x === piece.to.x
    const offset = Math.round(vertical ? piece.from.x + delta.x : piece.from.y + delta.y)
    const points = dragElbowSegment(current.pieces, current.joints, current.part.index, offset)
    current.preview.update(connector.id, {
      connectorControlPoints: points.map((control) => ({
        ...control,
        position: shifted(control.position, local)
      }))
    })
  }

  function connectorLineCommit() {
    const current = drag
    drag = null
    current?.preview.commit()
    ctx.requestRender()
  }

  function connectorLineCancel() {
    const current = drag
    drag = null
    current?.preview.cancel()
    ctx.requestRender()
  }

  return { connectorLineBegin, connectorLineDrag, connectorLineCommit, connectorLineCancel }
}
