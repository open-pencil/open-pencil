import type {
  ConnectorEndpoint,
  ConnectorLineType,
  SceneNode,
  StrokeCap
} from '@open-pencil/scene-graph'
import {
  CONNECTOR_STROKE_WEIGHT,
  CONNECTOR_THICK_STROKE_WEIGHT,
  connectorLineStyleFields,
  connectorSublayers,
  layoutConnector,
  type ConnectorLineStyle
} from '@open-pencil/scene-graph/connectors'
import { figJamColor, type FigJamColorName } from '@open-pencil/scene-graph/figjam'

import { recordSubtreeEdit } from '#core/editor/components/slots/history'
import type { EditorContext } from '#core/editor/types'

/** A straight connector attaches by its layers' centres, as Figma moves its magnets. */
function straightEnd(endpoint: ConnectorEndpoint | null): ConnectorEndpoint | null {
  if (!endpoint?.nodeId || endpoint.magnet === 'NONE') return endpoint
  return { ...endpoint, magnet: 'CENTER' }
}

/**
 * Connector commands from the Design panel: line type, caps, and the line's colour, weight and
 * dash, as FigJam's selection toolbar sets them. Each change records the
 * connectors' whole subtrees as one step, and the connectors route again.
 */
export function createConnectorStyleActions(ctx: EditorContext) {
  function edit(label: string, ids: Iterable<string>, change: (connector: SceneNode) => void) {
    const connectors = [...ids].flatMap((id) => {
      const node = ctx.graph.getNode(id)
      return node?.type === 'CONNECTOR' ? [node] : []
    })
    if (connectors.length === 0) return
    recordSubtreeEdit(
      ctx,
      label,
      connectors.map((connector) => connector.id),
      () => {
        // Routed inside the step, so undo and redo restore the route as well.
        for (const connector of connectors) {
          change(connector)
          layoutConnector(ctx.graph, connector)
        }
      }
    )
    ctx.requestRender()
  }

  function setConnectorLineType(ids: Iterable<string>, lineType: ConnectorLineType) {
    edit('Change connector line', ids, (connector) =>
      ctx.graph.updateNode(connector.id, {
        connectorLineType: lineType,
        ...(lineType === 'STRAIGHT' && {
          connectorStart: straightEnd(connector.connectorStart),
          connectorEnd: straightEnd(connector.connectorEnd)
        })
      })
    )
  }

  function setConnectorCap(ids: Iterable<string>, end: 'start' | 'end', cap: StrokeCap) {
    edit(end === 'start' ? 'Change start point' : 'Change end point', ids, (connector) =>
      ctx.graph.updateNode(connector.id, {
        [end === 'start' ? 'connectorStartCap' : 'connectorEndCap']: cap
      })
    )
  }

  function restyleLine(label: string, ids: Iterable<string>, style: Partial<ConnectorLineStyle>) {
    edit(label, ids, (connector) => {
      const line = connectorSublayers(ctx.graph, connector)?.line
      if (line) ctx.graph.updateNode(line.id, connectorLineStyleFields(line, style))
    })
  }

  /** Draws the connectors' lines in palette colour `name`. */
  function setConnectorColor(ids: Iterable<string>, name: FigJamColorName) {
    restyleLine('Change connector color', ids, { color: figJamColor(name) })
  }

  /** Draws the connectors' lines Thick or Thin, as FigJam's line menu does. */
  function setConnectorThick(ids: Iterable<string>, thick: boolean) {
    restyleLine('Change connector weight', ids, {
      weight: thick ? CONNECTOR_THICK_STROKE_WEIGHT : CONNECTOR_STROKE_WEIGHT
    })
  }

  /** Dashes the connectors' lines or draws them solid. */
  function setConnectorDashed(ids: Iterable<string>, dashed: boolean) {
    restyleLine(dashed ? 'Dash connector' : 'Draw connector solid', ids, { dashed })
  }

  return {
    setConnectorLineType,
    setConnectorCap,
    setConnectorColor,
    setConnectorThick,
    setConnectorDashed
  }
}
