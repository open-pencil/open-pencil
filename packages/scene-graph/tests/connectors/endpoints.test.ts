import { describe, expect, test } from 'bun:test'

import { SceneGraph, type VectorNetwork } from '@open-pencil/scene-graph'
import {
  boundEndpoint,
  buildConnectorSublayers,
  freeEndpoint
} from '@open-pencil/scene-graph/connectors'
import { applyGraphTransfer, prepareGraphTransfer } from '@open-pencil/scene-graph/transfer'

const straight = { tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }

/** An L route from (0, 0) right to (200, 0), then down to (200, 200). */
const L_ROUTE: VectorNetwork = {
  vertices: [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 200 }
  ],
  segments: [
    { start: 0, end: 1, ...straight },
    { start: 1, end: 2, ...straight }
  ],
  regions: []
}

function connectedBoxes() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const from = graph.createNode('RECTANGLE', page, {
    name: 'From',
    x: 0,
    y: 0,
    width: 100,
    height: 100
  })
  const to = graph.createNode('RECTANGLE', page, {
    name: 'To',
    x: 400,
    y: 400,
    width: 100,
    height: 100
  })
  const connector = graph.createNode('CONNECTOR', page, {
    x: 100,
    y: 50,
    width: 200,
    height: 200,
    connectorStart: boundEndpoint(from.id, 'RIGHT'),
    connectorEnd: boundEndpoint(to.id, 'TOP')
  })
  buildConnectorSublayers(graph, connector, {
    line: { vectorNetwork: L_ROUTE, width: 200, height: 200 }
  })
  return { graph, page, from, to, connector }
}

describe('connectors', () => {
  test('a click lands on a connector along its line, not in the empty box around its route', () => {
    const { graph, connector } = connectedBoxes()
    expect(graph.hitTest(200, 52)?.id).toBe(connector.id)
    expect(graph.hitTest(302, 150)?.id).toBe(connector.id)
    expect(graph.hitTest(150, 200)).toBeNull()
  })

  test('a copy with its layers binds to their copies; one without keeps naming the originals', () => {
    const { graph, page, from, to, connector } = connectedBoxes()
    const target = new SceneGraph()
    const together = prepareGraphTransfer({
      source: graph,
      target,
      rootIds: [from.id, to.id, connector.id],
      dependencyPageIds: [],
      parentId: target.getPages()[0].id
    })
    applyGraphTransfer(target, together)
    const copied = [...target.nodes.values()].find((node) => node.type === 'CONNECTOR')
    const fromCopy = [...target.nodes.values()].find((node) => node.name === 'From')
    expect(copied?.connectorStart?.nodeId).toBe(fromCopy?.id)
    expect(copied?.connectorStart?.nodeId).not.toBe(from.id)

    const alone = prepareGraphTransfer({
      source: graph,
      target: graph,
      rootIds: [connector.id],
      dependencyPageIds: [],
      parentId: page
    })
    const props = alone.nodes.find((node) => node.props.type === 'CONNECTOR')?.props
    expect(props?.connectorEnd?.nodeId).toBe(to.id)
  })

  test('a free end keeps its point', () => {
    expect(freeEndpoint(10, 20)).toEqual({
      nodeId: null,
      magnet: 'NONE',
      position: { x: 10, y: 20 }
    })
  })
})
