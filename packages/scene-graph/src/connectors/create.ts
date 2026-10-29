import type { SceneGraph } from '../graph'
import type { ConnectorEndpoint, ConnectorLineType, SceneNode, StrokeCap } from '../types'
import { layoutConnector } from './layout'
import { buildConnectorSublayers } from './sublayers'

/** What a new connector joins and how it looks; anything left out takes Figma's defaults. */
export interface ConnectorContent {
  start: ConnectorEndpoint
  end: ConnectorEndpoint
  lineType?: ConnectorLineType
  startCap?: StrokeCap
  endCap?: StrokeCap
  /** The label on the line. */
  text?: string
}

/**
 * Makes a connector in `parentId` with its line and label, routed between its ends. Figma names
 * a new connector "Connector line".
 */
/** The name FigJam gives a connector it draws. */
export const CONNECTOR_NAME = 'Connector line'

export function createConnector(
  graph: SceneGraph,
  parentId: string,
  content: ConnectorContent,
  props: Partial<SceneNode> = {}
): SceneNode {
  const connector = graph.createNode('CONNECTOR', parentId, {
    name: CONNECTOR_NAME,
    fills: [],
    strokes: [],
    connectorStart: structuredClone(content.start),
    connectorEnd: structuredClone(content.end),
    ...(content.lineType && { connectorLineType: content.lineType }),
    ...(content.startCap && { connectorStartCap: content.startCap }),
    ...(content.endCap && { connectorEndCap: content.endCap }),
    ...props
  })
  const text = content.text ?? ''
  buildConnectorSublayers(graph, connector, {
    label: { text },
    labelBackground: { visible: text !== '' }
  })
  layoutConnector(graph, connector)
  return connector
}
