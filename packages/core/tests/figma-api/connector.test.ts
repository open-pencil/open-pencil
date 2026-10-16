import { describe, expect, test } from 'bun:test'

import { pick } from 'es-toolkit'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { connectorSublayers, SceneGraph } from '@open-pencil/scene-graph'

function setup() {
  const graph = new SceneGraph()
  const api = new FigmaAPI(graph)
  const a = api.createRectangle()
  a.resize(100, 100)
  a.x = 0
  a.y = 0
  const b = api.createRectangle()
  b.resize(100, 100)
  b.x = 400
  b.y = 200
  return { graph, api, a, b }
}

// Values recorded from `figma.createConnector()` in FigJam desktop on 2026-10-15.
describe('ConnectorNode', () => {
  test('a new connector runs free from the page origin with an arrow at its end', () => {
    const { api } = setup()
    const connector = api.createConnector()
    const page = api.currentPage.id
    expect({
      name: connector.name,
      x: connector.x,
      y: connector.y,
      width: connector.width,
      height: connector.height,
      lineType: connector.connectorLineType,
      start: connector.connectorStart,
      end: connector.connectorEnd,
      startCap: connector.connectorStartStrokeCap,
      endCap: connector.connectorEndStrokeCap,
      strokeWeight: connector.strokeWeight,
      color: connector.strokes[0]?.type === 'SOLID' && pick(connector.strokes[0].color, ['r', 'g', 'b']),
      text: connector.text.characters
    }).toEqual({
      name: 'Connector line',
      x: 0,
      y: 0,
      width: 200,
      height: 0,
      lineType: 'ELBOWED',
      start: { endpointNodeId: page, position: { x: 0, y: 0 } },
      end: { endpointNodeId: page, position: { x: 200, y: 0 } },
      startCap: 'NONE',
      endCap: 'ARROW_LINES',
      strokeWeight: 4,
      color: { r: 117 / 255, g: 117 / 255, b: 117 / 255 },
      text: ''
    })
  })

  test('ends bound to layers report their magnets and route between them', () => {
    const { api, a, b } = setup()
    const connector = api.createConnector()
    connector.connectorStart = { endpointNodeId: a.id, magnet: 'AUTO' }
    connector.connectorEnd = { endpointNodeId: b.id, magnet: 'RIGHT' }
    expect(connector.connectorStart).toEqual({ endpointNodeId: a.id, magnet: 'AUTO' })
    expect(connector.connectorEnd).toEqual({ endpointNodeId: b.id, magnet: 'RIGHT' })
    // Figma's FigJam shapes keep 2 px further off for their stroke: 108 and 440 there.
    expect([connector.x, connector.y, connector.width, connector.height]).toEqual([
      106, 50, 442, 200
    ])

    connector.connectorEnd = { endpointNodeId: b.id, position: { x: 10, y: 20 } }
    expect(connector.connectorEnd).toEqual({ endpointNodeId: b.id, position: { x: 10, y: 20 } })

    a.x = 100
    expect(connector.x).toBe(206)
  })

  test('a straight connector attaches by centres and refuses side magnets', () => {
    const { api, a } = setup()
    const connector = api.createConnector()
    connector.connectorStart = { endpointNodeId: a.id, magnet: 'AUTO' }
    connector.connectorLineType = 'STRAIGHT'
    expect(connector.connectorStart).toEqual({ endpointNodeId: a.id, magnet: 'CENTER' })
    expect(() => {
      connector.connectorStart = { endpointNodeId: a.id, magnet: 'TOP' }
    }).toThrow(
      'in set_connectorStart: Straight connector endpoints may only use the CENTER or NONE magnets.'
    )
  })

  test('refuses unknown layers and caps a connector cannot take', () => {
    const { api } = setup()
    const connector = api.createConnector()
    expect(() => {
      connector.connectorStart = { endpointNodeId: 'nope', magnet: 'AUTO' }
    }).toThrow('in set_connectorStart: Invalid endpointNodeId')
    expect(() => {
      connector.connectorStartStrokeCap = 'ROUND' as ConnectorStrokeCap
    }).toThrow('in set_connectorStartStrokeCap: Property "connectorStartStrokeCap" failed validation')
    connector.connectorStartStrokeCap = 'DIAMOND_FILLED'
    expect(connector.connectorStartStrokeCap).toBe('DIAMOND_FILLED')
  })

  test('the label is its text and is laid on its plate', () => {
    const { graph, api } = setup()
    const connector = api.createConnector()
    connector.text.characters = 'Label'
    expect(connector.text.characters).toBe('Label')
    // Reading geometry routes the edit, as it lays out any other.
    const labelHeight = connector.text.height
    const node = graph.getNode(connector.id)
    const plate = node && connectorSublayers(graph, node)?.labelBackground
    expect([plate?.height, plate?.visible]).toEqual([labelHeight + 17, true])
  })

  test('its stroke lives on its line, as Figma presents it', () => {
    const { api } = setup()
    const connector = api.createConnector()
    connector.strokeWeight = 8
    connector.dashPattern = [10, 6]
    expect([connector.strokeWeight, connector.dashPattern]).toEqual([8, [10, 6]])
  })

  test('removing a layer it joins removes the connector, as Figma does', () => {
    const { api, a } = setup()
    const connector = api.createConnector()
    connector.connectorStart = { endpointNodeId: a.id, magnet: 'AUTO' }
    a.remove()
    expect(connector.removed).toBe(true)
  })
})
