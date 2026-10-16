import { describe, expect, test } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import { renderJSX } from '@open-pencil/core/design-jsx'
import { sceneNodeToJSX } from '@open-pencil/design-jsx'
import { connectorRouteEnds, connectorSublayers, SceneGraph } from '@open-pencil/scene-graph'

const FLOW = `
  <Frame name="Flow" w={800} h={400}>
    <Frame name="Start" x={0} y={100} w={200} h={100} bg="#DDE3F5" />
    <Frame name="Done" x={500} y={200} w={200} h={100} bg="#DDE3F5" />
    <Connector from="Start" to="Done" endCap="circle_filled">Next</Connector>
    <Connector from="Done" to={{ x: 750, y: 40 }} line="curved" />
  </Frame>`

describe('connectors in design JSX', () => {
  test('join the layers they name and route once laid out', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(graph, FLOW)
    const flow = getNodeOrThrow(graph, result.id)
    const [start, done, next, free] = graph.getChildren(flow.id)
    expect(next.connectorStart).toMatchObject({ nodeId: start.id, magnet: 'AUTO' })
    expect(next.connectorEnd).toMatchObject({ nodeId: done.id, magnet: 'AUTO' })
    expect(next.connectorEndCap).toBe('CIRCLE_FILLED')
    expect(free.connectorEnd).toMatchObject({ nodeId: null, position: { x: 750, y: 40 } })
    expect(connectorRouteEnds(graph, next)).toEqual({
      start: { x: 206, y: 150 },
      end: { x: 500, y: 250 }
    })
  })

  test('write back as Connector elements that name their layers', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(graph, FLOW)
    const jsx = sceneNodeToJSX(result.id, graph)
    expect(jsx).toContain('<Connector from="Start" to="Done" endCap="circle_filled">Next</Connector>')
    expect(jsx).toContain('<Connector from="Done" to={{ x: 750, y: 40 }} line="curved" />')

    const again = new SceneGraph()
    const [reread] = await renderJSX(again, jsx)
    expect(sceneNodeToJSX(reread.id, again)).toBe(jsx)
  })

  test('restyle the line by each stroke prop alone, and write the style back', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(
      graph,
      `<Frame name="Flow" w={800} h={400}>
        <Frame name="A" x={0} y={0} w={100} h={100} />
        <Frame name="B" x={400} y={0} w={100} h={100} />
        <Connector from="A" to="B" strokeWidth={8} />
        <Connector from="A" to="B" stroke="#FF0000" dashPattern={[6, 4]} />
      </Frame>`
    )
    const [, , heavy, dashed] = graph.getChildren(result.id)
    const heavyLine = connectorSublayers(graph, heavy)?.line
    expect(heavyLine?.strokes[0]).toMatchObject({ weight: 8, color: { r: 117 / 255 }, cap: 'ROUND' })
    const dashedLine = connectorSublayers(graph, dashed)?.line
    expect(dashedLine?.strokes[0]).toMatchObject({ weight: 4, color: { r: 1, g: 0, b: 0 } })
    expect(dashedLine?.dashPattern).toEqual([6, 4])
    const jsx = sceneNodeToJSX(result.id, graph)
    expect(jsx).toContain('<Connector from="A" to="B" strokeWidth={8} />')
    expect(jsx).toContain('<Connector from="A" to="B" stroke="#FF0000" dashPattern={[6, 4]} />')
  })

  test('an end naming no layer is left free, with a warning', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(
      graph,
      '<Frame name="Flow" w={400} h={200}><Frame name="A" w={50} h={50} /><Connector from="A" to="Nowhere" /></Frame>'
    )
    expect(result.warnings).toContain('<Connector> to="Nowhere" names no layer.')
  })
})
