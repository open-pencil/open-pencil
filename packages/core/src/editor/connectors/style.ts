import {
  layoutConnector,
  type ConnectorEndpoint,
  type ConnectorLineType,
  type SceneNode,
  type StrokeCap
} from '@open-pencil/scene-graph'

import { recordSubtreeEdit } from '#core/editor/components/slots/history'
import type { EditorContext } from '#core/editor/types'

/** A straight connector attaches by its layers' centres, as Figma moves its magnets. */
function straightEnd(endpoint: ConnectorEndpoint | null): ConnectorEndpoint | null {
  if (!endpoint?.nodeId || endpoint.magnet === 'NONE') return endpoint
  return { ...endpoint, magnet: 'CENTER' }
}

/**
 * Connector commands from the Design panel: line type and caps. Each change records the
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

  return { setConnectorLineType, setConnectorCap }
}
