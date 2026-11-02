import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SceneGraph } from '@open-pencil/scene-graph'
import { connectorRoute, createConnector, freeEndpoint } from '@open-pencil/scene-graph/connectors'

import { applyArrangement } from '#core/layout/arrange/apply'
import { arrangeBoxes, type ArrangeInput } from '#core/layout/arrange/boxes'

describe('applyArrangement', () => {
  test('arranges existing layers and joins their connector by the sides the layout chose', async () => {
    const graph = new SceneGraph()
    const pageId = expectDefined(graph.getPages()[0]).id
    const section = graph.createNode('SECTION', pageId, { x: 500, y: 500 })
    const first = graph.createNode('RECTANGLE', pageId, { x: 300, y: 300, width: 100, height: 40 })
    const second = graph.createNode('RECTANGLE', section.id, { width: 100, height: 40 })
    const connector = createConnector(graph, pageId, {
      start: freeEndpoint(0, 0),
      end: freeEndpoint(0, 0)
    })
    const input: ArrangeInput = {
      layout: 'flow',
      direction: 'LR',
      boxes: [
        { id: 'a', width: 100, height: 40 },
        { id: 'b', width: 100, height: 40, group: 'g' }
      ],
      groups: [{ id: 'g' }],
      edges: [{ id: 'ab', from: 'a', to: 'b' }]
    }
    const layout = await arrangeBoxes(input)

    applyArrangement(
      graph,
      input,
      layout,
      {
        boxes: new Map([
          ['a', first.id],
          ['b', second.id],
          ['g', section.id]
        ]),
        connectors: new Map([['ab', connector.id]])
      },
      { topLeft: { x: 0, y: 0 } }
    )

    const placedFirst = expectDefined(graph.getNode(first.id))
    const placedSection = expectDefined(graph.getNode(section.id))
    const placedSecond = expectDefined(graph.getNode(second.id))
    // The drawing starts at the top-left corner it was given.
    expect(Math.min(placedFirst.x, placedSection.x)).toBe(0)
    expect(Math.min(placedFirst.y, placedSection.y)).toBe(0)
    // The group's layer takes the layout's size and holds its member in its own axes.
    expect(placedSection.width).toBe(expectDefined(layout.groups.get('g')).width)
    expect(placedSecond.x).toBeGreaterThan(0)
    expect(placedSecond.x + placedSecond.width).toBeLessThan(placedSection.width)
    expect(placedFirst.x + placedFirst.width).toBeLessThan(placedSection.x)
    const joined = expectDefined(graph.getNode(connector.id))
    expect(joined.connectorStart).toMatchObject({ nodeId: first.id, magnet: 'RIGHT' })
    expect(joined.connectorEnd).toMatchObject({ nodeId: second.id, magnet: 'LEFT' })
  })
})

describe('applyArrangement routes', () => {
  test('runs each connector through the corners of the route the layout gave it', async () => {
    const graph = new SceneGraph()
    const pageId = expectDefined(graph.getPages()[0]).id
    const box = () => graph.createNode('RECTANGLE', pageId, { width: 100, height: 40 }).id
    const boxes = new Map([
      ['a', box()],
      ['b', box()],
      ['c', box()]
    ])
    const connector = () =>
      createConnector(graph, pageId, { start: freeEndpoint(0, 0), end: freeEndpoint(0, 0) }).id
    const connectors = new Map([
      ['ab', connector()],
      ['ac', connector()]
    ])
    const input: ArrangeInput = {
      layout: 'flow',
      direction: 'TB',
      boxes: ['a', 'b', 'c'].map((id) => ({ id, width: 100, height: 40 })),
      groups: [],
      edges: [
        { id: 'ab', from: 'a', to: 'b' },
        { id: 'ac', from: 'a', to: 'c' }
      ]
    }
    const layout = await arrangeBoxes(input)
    const origin = { x: 1000, y: 2000 }

    applyArrangement(graph, input, layout, { boxes, connectors }, { topLeft: origin })

    const all = [...layout.boxes.values()]
    const shift = {
      x: origin.x - Math.min(...all.map((rect) => rect.x)),
      y: origin.y - Math.min(...all.map((rect) => rect.y))
    }
    let bent = 0
    for (const [edgeId, connectorId] of connectors) {
      const route = expectDefined(layout.edges.get(edgeId))
      const corners = route.points
        .slice(1, -1)
        .map((point) => ({ x: point.x + shift.x, y: point.y + shift.y }))
      const drawn = expectDefined(connectorRoute(graph, expectDefined(graph.getNode(connectorId))))
      const drawnCorners = drawn.pieces.slice(1).map((piece) => piece.from)
      expect(drawnCorners).toEqual(corners)
      bent += corners.length
    }
    // A fan-out bends at least one of its edges.
    expect(bent).toBeGreaterThan(0)
  })
})
