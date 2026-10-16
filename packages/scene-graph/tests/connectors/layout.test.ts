import { describe, expect, test } from 'bun:test'

import {
  attachedConnectors,
  boundEndpoint,
  buildConnectorSublayers,
  connectorRouteEnds,
  connectorSublayers,
  freeEndpoint,
  layoutConnector,
  SceneGraph
} from '@open-pencil/scene-graph'

function boxes() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const from = graph.createNode('RECTANGLE', page, { x: 0, y: 0, width: 100, height: 100 })
  const to = graph.createNode('RECTANGLE', page, { x: 400, y: 0, width: 100, height: 100 })
  const connector = graph.createNode('CONNECTOR', page, {
    connectorStart: boundEndpoint(from.id),
    connectorEnd: boundEndpoint(to.id)
  })
  buildConnectorSublayers(graph, connector)
  return { graph, page, from, to, connector }
}

describe('connector layout', () => {
  test('places the connector on its route and the line inside it', () => {
    const { graph, connector } = boxes()
    expect(layoutConnector(graph, connector)).toBe(true)
    const { line } = connectorSublayers(graph, connector) ?? {}
    expect([connector.x, connector.y, connector.width, connector.height]).toEqual([106, 50, 287.5, 0])
    expect([line?.x, line?.y, line?.width, line?.height]).toEqual([0, 0, 287.5, 0])
    expect(line?.vectorNetwork?.vertices).toEqual([
      { x: 0, y: 0, strokeCap: 'ROUND' },
      { x: 287.5, y: 0, strokeCap: 'ARROW_LINES' }
    ])
    expect(layoutConnector(graph, connector)).toBe(false)
  })

  test('an end whose layer is gone stays where the route last ended', () => {
    const { graph, to, connector } = boxes()
    layoutConnector(graph, connector)
    graph.deleteNode(to.id)
    graph.updateNode(connector.id, { connectorEnd: boundEndpoint(to.id) })
    layoutConnector(graph, connector)
    expect(connectorRouteEnds(graph, connector)?.end).toEqual({ x: 393.5, y: 50 })
  })

  test('a point on a layer follows the layer', () => {
    const { graph, from, connector } = boxes()
    graph.updateNode(connector.id, {
      connectorLineType: 'STRAIGHT',
      connectorStart: { nodeId: from.id, magnet: 'NONE', position: { x: 100, y: 20 } },
      connectorEnd: freeEndpoint(300, 20)
    })
    graph.updateNode(from.id, { y: 30 })
    layoutConnector(graph, connector)
    expect(connectorRouteEnds(graph, connector)).toEqual({
      start: { x: 100, y: 50 },
      end: { x: 300, y: 20 }
    })
  })

  test('the connectors attached to deleted layers are those with an end on or inside them', () => {
    const { graph, page, from, connector } = boxes()
    const frame = graph.createNode('FRAME', page, { x: 0, y: 300, width: 200, height: 200 })
    const inner = graph.createNode('RECTANGLE', frame.id, { width: 50, height: 50 })
    const nested = graph.createNode('CONNECTOR', page, {
      connectorStart: boundEndpoint(inner.id),
      connectorEnd: freeEndpoint(500, 500)
    })
    const inside = graph.createNode('CONNECTOR', frame.id, {
      connectorStart: boundEndpoint(inner.id),
      connectorEnd: freeEndpoint(0, 0)
    })
    expect(attachedConnectors(graph, [from.id]).map((node) => node.id)).toEqual([connector.id])
    expect(attachedConnectors(graph, [frame.id]).map((node) => node.id)).toEqual([nested.id])
    expect(attachedConnectors(graph, [inner.id]).map((node) => node.id).sort()).toEqual(
      [nested.id, inside.id].sort()
    )
  })
})
