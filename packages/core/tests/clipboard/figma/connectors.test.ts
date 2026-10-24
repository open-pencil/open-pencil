import { beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import * as v from 'valibot'

import { expectDefined } from '#core-tests/helpers/assert'
import { FIXTURES } from '#core-tests/helpers/paths'

import { buildFigmaClipboardHTML, importClipboardNodes } from '@open-pencil/core/clipboard'
import { parseFigmaClipboard } from '@open-pencil/fig/clipboard'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import {
  boundEndpoint,
  connectorSublayers,
  createConnector,
  freeEndpoint,
  layoutConnector
} from '@open-pencil/scene-graph/connectors'
import type { Vector } from '@open-pencil/scene-graph/primitives'

/** Two FigJam stickies joined by four connectors, as FigJam copies them. */
const FIXTURE = join(FIXTURES, 'clipboard/figjam-connectors.html')

async function importFixture(html: string) {
  const parsed = expectDefined(await parseFigmaClipboard(html))
  const graph = new SceneGraph()
  const ids = importClipboardNodes(parsed.nodes, graph, graph.getPages()[0].id, 0, 0, parsed.blobs)
  const byName = (name: string) =>
    expectDefined(ids.map((id) => graph.getNode(id)).find((node) => node?.name === name))
  return { graph, ids, byName }
}

function endName(graph: SceneGraph, connector: SceneNode, end: 'connectorStart' | 'connectorEnd') {
  const id = connector[end]?.nodeId
  return id ? graph.getNode(id)?.name : null
}

beforeAll(initCodec)

describe('FigJam connectors', () => {
  test('import binds their ends and keeps the route, caps, and label Figma drew', async () => {
    const { graph, byName } = await importFixture(await Bun.file(FIXTURE).text())
    const elbow = byName('c-elbow-auto')
    expect(elbow).toMatchObject({
      type: 'CONNECTOR',
      connectorLineType: 'ELBOWED',
      connectorStartCap: 'ROUND',
      connectorEndCap: 'ARROW_LINES'
    })
    expect([
      endName(graph, elbow, 'connectorStart'),
      endName(graph, elbow, 'connectorEnd')
    ]).toEqual(['c-A', 'c-B'])
    const { line, label, labelBackground } = expectDefined(connectorSublayers(graph, elbow))
    expect(line.vectorNetwork?.vertices.length).toBe(6)
    expect(line.cornerRadius).toBe(24)
    expect(label).toMatchObject({ text: 'label', visible: true })
    expect(labelBackground.visible).toBe(true)

    // Its end on a FigJam shape with text binds to the shape it pasted as.
    const straight = byName('c-straight-magnets')
    expect(straight.connectorEnd).toMatchObject({ magnet: 'CENTER' })
    expect(endName(graph, straight, 'connectorEnd')).toBe('c-shape')
    const free = byName('c-curved-free')
    expect(free.connectorEnd).toEqual({
      nodeId: null,
      magnet: 'NONE',
      position: { x: 1200, y: 3000 }
    })
  })

  test('export writes them as Figma does, and reading the export back keeps the route', async () => {
    const { graph, ids } = await importFixture(await Bun.file(FIXTURE).text())
    const html = expectDefined(
      await buildFigmaClipboardHTML(
        ids.map((id) => expectDefined(graph.getNode(id))),
        graph
      )
    )
    const parsed = expectDefined(await parseFigmaClipboard(html))
    const record = expectDefined(parsed.nodes.find((node) => node.name === 'c-elbow-auto'))
    expect(record.type).toBe('CONNECTOR')
    expect(record.connectorLineStyle).toBe('ELBOWED')
    expect(record.fillPaints).toBeUndefined()
    const stickies = new Map(
      parsed.nodes.filter((node) => node.type === 'STICKY').map((node) => [node.name, node.guid])
    )
    expect(record.connectorStart).toMatchObject({
      endpointNodeID: stickies.get('c-A'),
      magnet: 'AUTO'
    })
    expect(record.connectorEnd).toMatchObject({
      endpointNodeID: stickies.get('c-B'),
      magnet: 'AUTO'
    })

    const reread = await importFixture(html)
    const elbow = reread.byName('c-elbow-auto')
    expect(endName(reread.graph, elbow, 'connectorEnd')).toBe('c-B')
    expect(connectorSublayers(reread.graph, elbow)?.line.vectorNetwork?.vertices.length).toBe(6)
  })

  test('a connector saved without its route is routed as Figma routed it', async () => {
    const html = await Bun.file(FIXTURE).text()
    const drawn = await importFixture(html)
    const parsed = expectDefined(await parseFigmaClipboard(html))
    for (const node of parsed.nodes) {
      if (node.type === 'CONNECTOR') delete node.derivedImmutableFrameData
    }
    const graph = new SceneGraph()
    const ids = importClipboardNodes(
      parsed.nodes,
      graph,
      graph.getPages()[0].id,
      0,
      0,
      parsed.blobs
    )
    // The fixture's other two connectors keep a cut from a label since cleared, and one ends on
    // a layer left out of the copy, so Figma's saved routes for them are not what it would route.
    const routed = ['c-elbow-auto', 'c-curved-free'].map((name) =>
      expectDefined(ids.map((id) => graph.getNode(id)).find((node) => node?.name === name))
    )
    for (const connector of routed) {
      const figma = drawn.byName(connector.name)
      // Text layout sizes a label once its font loads, and the connector routes around it again.
      const label = expectDefined(connectorSublayers(graph, connector)).label
      const { width, height } = expectDefined(connectorSublayers(drawn.graph, figma)).label
      graph.updateNode(label.id, { width, height })
      layoutConnector(graph, connector)
      expect({ name: connector.name, route: pageRoute(graph, connector) }).toEqual({
        name: connector.name,
        route: pageRoute(drawn.graph, figma)
      })
    }
  })
})

/** A curve's control points as a `.fig` record keeps them. */
const HANDLES = v.optional(
  v.array(v.object({ position: v.object({ x: v.number(), y: v.number() }) }))
)

test('a connector copied before a layer it joins keeps both ends joined', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const target = graph.createNode('RECTANGLE', page, { name: 'Target', x: 400, width: 100, height: 100 })
  const connector = createConnector(graph, page, {
    start: freeEndpoint(0, 0),
    end: freeEndpoint(0, 0)
  })
  const before = graph.createNode('RECTANGLE', page, { name: 'Before', width: 100, height: 100 })
  graph.updateNode(connector.id, {
    name: 'Joined',
    connectorStart: boundEndpoint(before.id),
    connectorEnd: boundEndpoint(target.id)
  })
  // The connector is written before Before, whose GUID it then has no record of yet.
  const nodes = [target, connector, before].map((node) => expectDefined(graph.getNode(node.id)))
  const parsed = expectDefined(
    await parseFigmaClipboard(expectDefined(await buildFigmaClipboardHTML(nodes, graph)))
  )
  const guidOf = (name: string) => parsed.nodes.find((node) => node.name === name)?.guid
  const record = expectDefined(parsed.nodes.find((node) => node.name === 'Joined'))
  expect(record.connectorStart).toMatchObject({ endpointNodeID: guidOf('Before'), magnet: 'AUTO' })
  expect(record.connectorEnd).toMatchObject({ endpointNodeID: guidOf('Target'), magnet: 'AUTO' })
})

/**
 * A FigJam section holding two shapes, an elbow dragged at its middle and then its first segment,
 * and a curve dragged at its midpoint, as FigJam copies them.
 */
const DRAGGED = join(FIXTURES, 'clipboard/figjam-connector-controls.html')

describe('FigJam connectors dragged into place', () => {
  test('keep their control points and route again as Figma drew them', async () => {
    const { graph } = await importFixture(await Bun.file(DRAGGED).text())
    // They sit inside the section the copy holds.
    const named = (name: string) =>
      expectDefined([...graph.getAllNodes()].find((node) => node.name === name))
    const elbow = named('cp-elbow')
    const curve = named('cp-curve')
    // Figma keeps them in the section's axes; here they are in the connector's own.
    expect(
      elbow.connectorControlPoints.map(({ position, direction }) => [
        direction,
        position.x + elbow.x,
        position.y + elbow.y
      ])
    ).toEqual([
      ['VERTICAL', 304, 80],
      ['HORIZONTAL', 376, 48],
      ['VERTICAL', 448, 240]
    ])
    expect(curve.connectorCurveHandles).not.toBeNull()
    for (const connector of [elbow, curve]) {
      const figma = pageRoute(graph, connector)
      layoutConnector(graph, connector)
      expect({ name: connector.name, route: pageRoute(graph, connector) }).toEqual({
        name: connector.name,
        route: figma
      })
    }
  })

  test('export writes their control points where Figma wrote them', async () => {
    const html = await Bun.file(DRAGGED).text()
    const source = expectDefined(await parseFigmaClipboard(html))
    const { graph, ids } = await importFixture(html)
    // A label dragged along the line keeps its place.
    const elbow = expectDefined(
      [...graph.getAllNodes()].find((node) => node.name === 'cp-elbow')
    )
    graph.updateNode(elbow.id, {
      connectorLabelPosition: { section: 'MIDDLE_TO_END', offset: 0.5, offAxis: 'ABOVE' }
    })
    const exported = expectDefined(
      await parseFigmaClipboard(
        expectDefined(
          await buildFigmaClipboardHTML(
            ids.map((id) => expectDefined(graph.getNode(id))),
            graph
          )
        )
      )
    )
    for (const name of ['cp-elbow', 'cp-curve']) {
      const before = expectDefined(source.nodes.find((node) => node.name === name))
      const after = expectDefined(exported.nodes.find((node) => node.name === name))
      expect({ name, points: after.connectorControlPoints }).toEqual({
        name,
        points: before.connectorControlPoints
      })
      const handles = (node: typeof before) =>
        v
          .parse(HANDLES, node.connectorBezierControlPoints)
          ?.map(({ position }) => [
            Math.round(position.x * 100) / 100,
            Math.round(position.y * 100) / 100
          ])
      expect({ name, handles: handles(after) }).toEqual({ name, handles: handles(before) })
    }
    const reread = expectDefined(exported.nodes.find((node) => node.name === 'cp-elbow'))
    expect(reread.connectorTextMidpoint).toEqual({
      section: 'MIDDLE_TO_END',
      offset: 0.5,
      offAxisOffset: 'ABOVE'
    })
  })
})

/** A connector's line as rounded page points, segment by segment. */
function pageRoute(graph: SceneGraph, connector: SceneNode) {
  const line = expectDefined(connectorSublayers(graph, connector)).line
  const network = expectDefined(line.vectorNetwork)
  const at = (index: number) => {
    const vertex = network.vertices[index]
    return [
      Math.round((connector.x + line.x + vertex.x) * 10) / 10,
      Math.round((connector.y + line.y + vertex.y) * 10) / 10
    ]
  }
  const round = ({ x, y }: Vector) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]
  return network.segments.map((segment) => [
    at(segment.start),
    at(segment.end),
    round(segment.tangentStart),
    round(segment.tangentEnd)
  ])
}
