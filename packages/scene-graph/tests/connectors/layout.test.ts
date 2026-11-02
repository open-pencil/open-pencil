import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Stroke } from '@open-pencil/scene-graph'
import {
  attachedConnectors,
  boundEndpoint,
  buildConnectorSublayers,
  connectorRouteEnds,
  connectorSublayers,
  createConnector,
  freeEndpoint,
  layoutConnector
} from '@open-pencil/scene-graph/connectors'
import { BLACK } from '@open-pencil/scene-graph/constants'

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
    expect([connector.x, connector.y, connector.width, connector.height]).toEqual([
      106, 50, 287.5, 0
    ])
    expect([line?.x, line?.y, line?.width, line?.height]).toEqual([0, 0, 287.5, 0])
    expect(line?.vectorNetwork?.vertices).toEqual([
      { x: 0, y: 0, strokeCap: 'ROUND' },
      { x: 287.5, y: 0, strokeCap: 'ARROW_LINES' }
    ])
    expect(layoutConnector(graph, connector)).toBe(false)
  })

  test('a shape keeps the connector clear of its stroke, hidden or not, and not of none', () => {
    const startFor = (strokes: Stroke[]) => {
      const graph = new SceneGraph()
      const page = graph.getPages()[0].id
      const shape = (x: number) =>
        graph.createNode('SHAPE_WITH_TEXT', page, {
          x,
          width: 100,
          height: 100,
          strokeWeight: 4,
          strokes
        })
      const connector = graph.createNode('CONNECTOR', page, {
        connectorStart: boundEndpoint(shape(0).id),
        connectorEnd: boundEndpoint(shape(400).id)
      })
      buildConnectorSublayers(graph, connector)
      layoutConnector(graph, connector)
      return connectorRouteEnds(graph, connector)?.start.x
    }
    const stroke: Stroke = {
      type: 'SOLID',
      color: BLACK,
      opacity: 1,
      visible: true,
      weight: 4,
      align: 'CENTER'
    }
    // Measured in FigJam: a weight 4 connector stops 6 from a shape, plus half its stroke.
    expect(startFor([stroke])).toBe(108)
    expect(startFor([{ ...stroke, visible: false }])).toBe(108)
    expect(startFor([])).toBe(106)
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
    expect(
      attachedConnectors(graph, [inner.id])
        .map((node) => node.id)
        .sort()
    ).toEqual([nested.id, inside.id].sort())
  })
})

test('the graph keeps its connectors indexed as they come and go', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const connector = createConnector(graph, page, {
    start: freeEndpoint(0, 0),
    end: freeEndpoint(100, 0)
  })
  expect(graph.connectorIds.has(connector.id)).toBe(true)
  graph.deleteNode(connector.id)
  expect(graph.connectorIds.has(connector.id)).toBe(false)
})

// Live Figma Design 2026-10-25: an elbow from a 96 × 64 shape's AUTO to a 200 px square's CENTER
// runs down, across midway, and down into the square, stopping its end gap short of the centre.
test('an elbow joined at the centre runs into the layer to its centre', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const from = graph.createNode('RECTANGLE', page, { x: 4980, y: 4915, width: 96, height: 64 })
  const to = graph.createNode('RECTANGLE', page, { x: 5020, y: 5085, width: 200, height: 200 })
  const connector = createConnector(graph, page, {
    start: boundEndpoint(from.id),
    end: boundEndpoint(to.id, 'CENTER'),
    startCap: 'ROUND',
    endCap: 'ARROW_LINES'
  })
  layoutConnector(graph, connector)
  const laid = graph.getNode(connector.id) ?? connector
  expect(connectorRouteEnds(graph, laid)?.end).toEqual({ x: 5120, y: 5178.5 })
  const line = connectorSublayers(graph, laid)?.line
  const ys = (line?.vectorNetwork?.vertices ?? []).map((v) => laid.y + (line?.y ?? 0) + v.y)
  expect(ys).toContain(5082)
  // A straight connector still stops at the outline.
  graph.updateNode(connector.id, { connectorLineType: 'STRAIGHT' })
  const straight = graph.getNode(connector.id) ?? connector
  layoutConnector(graph, straight)
  expect(connectorRouteEnds(graph, straight)?.end.y).toBeLessThan(5085)
})
