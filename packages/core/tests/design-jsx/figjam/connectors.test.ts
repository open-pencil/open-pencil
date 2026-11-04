import { describe, expect, test } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import { renderJSX } from '@open-pencil/core/design-jsx'
import {
  designJSXElement,
  sceneNodeToJSX,
  selectionToJSX,
  selectionToJSXWithLayers
} from '@open-pencil/design-jsx'
import { SceneGraph } from '@open-pencil/scene-graph'
import { connectorRouteEnds, connectorSublayers } from '@open-pencil/scene-graph/connectors'

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
    expect(next.connectorStart).toMatchObject({
      nodeId: start.id,
      magnet: 'AUTO'
    })
    expect(next.connectorEnd).toMatchObject({
      nodeId: done.id,
      magnet: 'AUTO'
    })
    expect(next.connectorEndCap).toBe('CIRCLE_FILLED')
    expect(free.connectorEnd).toMatchObject({
      nodeId: null,
      position: { x: 750, y: 40 }
    })
    expect(connectorRouteEnds(graph, next)).toEqual({
      start: { x: 206, y: 150 },
      end: { x: 500, y: 250 }
    })
  })

  test('write back as Connector elements that name their layers', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(graph, FLOW)
    const jsx = sceneNodeToJSX(result.id, graph)
    expect(jsx).toContain(
      '<Connector from="Start" to="Done" endCap="circle_filled">Next</Connector>'
    )
    expect(jsx).toContain('<Connector from="Done" to={{ x: 750, y: 40 }} line="curved" />')

    const again = new SceneGraph()
    const [reread] = await renderJSX(again, jsx)
    expect(sceneNodeToJSX(reread.id, again)).toBe(jsx)
  })

  test('exported alone, write ends on layers outside the export as the points they are drawn at', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(graph, FLOW)
    const [, , next] = graph.getChildren(result.id)
    const jsx = sceneNodeToJSX(next.id, graph)
    expect(jsx).toBe(
      '<Connector from={{ x: 206, y: 150 }} to={{ x: 500, y: 250 }} endCap="circle_filled">Next</Connector>'
    )

    const again = new SceneGraph()
    const [reread] = await renderJSX(again, jsx)
    expect(reread.warnings ?? []).toEqual([])
    expect(sceneNodeToJSX(reread.id, again)).toBe(jsx)
  })

  test('describe themselves to an editor as their export writes them', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(graph, FLOW)
    const [, , next] = graph.getChildren(result.id)
    expect(designJSXElement(next.id, graph)).toEqual({
      tag: 'Connector',
      attributes: { from: 'from="Start"', to: 'to="Done"', endCap: 'endCap="circle_filled"' },
      text: 'Next',
      childIds: []
    })
  })

  test("never join a connector's own line or label, though they have names", async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(
      graph,
      `<Frame name="Flow" w={800} h={400}>
        <Connector from={{ x: 0, y: 0 }} to={{ x: 100, y: 0 }}>Note</Connector>
        <Frame name="Line" x={0} y={100} w={100} h={100} />
        <Frame name="Label" x={500} y={100} w={100} h={100} />
        <Connector from="Line" to="Label" />
      </Frame>`
    )
    const [, line, label, joined] = graph.getChildren(result.id)
    expect(result.warnings ?? []).toEqual([])
    expect(joined.connectorStart?.nodeId).toBe(line.id)
    expect(joined.connectorEnd?.nodeId).toBe(label.id)
    expect(sceneNodeToJSX(result.id, graph)).toContain('<Connector from="Line" to="Label" />')
  })

  const TWIN_CARDS = `const left = ref()
const right = ref()
return <Frame name="Flow" w={800} h={400}>
  <Frame name="Card" x={0} y={100} w={200} h={100} ref={left} />
  <Frame name="Card" x={500} y={100} w={200} h={100} ref={right} />
  <Connector from={left} to={right} />
</Frame>`

  test('join the layers marked with the refs they take, whatever the layers are named', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(graph, TWIN_CARDS)
    const [left, right, connector] = graph.getChildren(result.id)
    expect(result.warnings ?? []).toEqual([])
    expect(connector.connectorStart?.nodeId).toBe(left.id)
    expect(connector.connectorEnd?.nodeId).toBe(right.id)
  })

  test('write layers that share a name as refs, and read them back the same', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(graph, TWIN_CARDS)
    const jsx = sceneNodeToJSX(result.id, graph)
    expect(jsx).toStartWith('const card1 = ref()\nconst card2 = ref()\n\nreturn <Frame name="Flow"')
    expect(jsx).toContain('ref={card1} />')
    expect(jsx).toContain('<Connector from={card1} to={card2} />')

    const again = new SceneGraph()
    const [reread] = await renderJSX(again, jsx)
    expect(reread.warnings ?? []).toEqual([])
    const [left, right, connector] = again.getChildren(reread.id)
    expect(connector.connectorStart?.nodeId).toBe(left.id)
    expect(connector.connectorEnd?.nodeId).toBe(right.id)
    expect(sceneNodeToJSX(reread.id, again)).toBe(jsx)
  })

  test('write several layers that need refs as one returned fragment, and read it back', async () => {
    const graph = new SceneGraph()
    const results = await renderJSX(
      graph,
      `const left = ref()
const right = ref()
return <>
  <Frame name="Card" x={0} y={100} w={200} h={100} ref={left} />
  <Frame name="Card" x={500} y={100} w={200} h={100} ref={right} />
  <Connector from={left} to={right} />
</>`
    )
    const jsx = selectionToJSX(
      results.map(({ id }) => id),
      graph
    )
    expect(jsx).toStartWith(
      'const card1 = ref()\nconst card2 = ref()\n\nreturn <>\n  <Frame name="Card"'
    )
    expect(jsx).toEndWith('\n</>')
    const again = new SceneGraph()
    const reread = await renderJSX(again, jsx)
    const [left, right, connector] = reread.map(({ id }) => again.getNode(id))
    expect(connector?.connectorStart?.nodeId).toBe(left?.id)
    expect(connector?.connectorEnd?.nodeId).toBe(right?.id)
  })

  test('without declarations, write ends whose layers share a name as their points', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(graph, TWIN_CARDS)
    const { code } = selectionToJSXWithLayers([result.id], graph, { declarations: false })
    expect(code).toStartWith('<Frame name="Flow"')
    expect(code).not.toContain('ref')
    expect(code).toContain('<Connector from={{ x: 206, y: 150 }} to={{ x: 493.5, y: 150 }} />')
  })

  test('warn for a name more than one layer has, and for refs that mark no layer or two', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(
      graph,
      `const twice = ref()
const unused = ref()
return <Frame name="Flow" w={800} h={400}>
  <Frame name="Card" w={100} h={100} ref={twice} />
  <Frame name="Card" x={300} w={100} h={100} ref={twice} />
  <Connector from="Card" to={unused} />
</Frame>`
    )
    expect(result.warnings).toEqual([
      'One ref() marks both "Card" and "Card"; it refers to "Card".',
      '<Connector> from="Card" names 2 layers and joins the first; mark the one to join with ref().',
      '<Connector> to={ref} refers to no layer.'
    ])
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
    expect(heavyLine?.strokes[0]).toMatchObject({
      weight: 8,
      color: { r: 117 / 255 },
      cap: 'ROUND'
    })
    const dashedLine = connectorSublayers(graph, dashed)?.line
    expect(dashedLine?.strokes[0]).toMatchObject({
      weight: 4,
      color: { r: 1, g: 0, b: 0 }
    })
    expect(dashedLine?.dashPattern).toEqual([6, 4])
    // The stroke draws with the dash too, or the line would stay solid on the canvas.
    expect(dashedLine?.strokes[0]?.dashPattern).toEqual([6, 4])
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

  test('a prop of the wrong kind warns and is left out, and end warnings are kept', async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(
      graph,
      '<Frame name="Flow" w={400} h={200}><Frame name="A" w={50} h={50} /><Connector from={5} to="A" stroke="nope" strokeWidth={0} /></Frame>'
    )
    expect(result.warnings).toEqual([
      'Invalid from 5 on <connector> is ignored; expected a layer name, a ref(), or { x, y }.',
      'Invalid stroke "nope" on <connector> is ignored; expected a colour.',
      'Invalid strokeWidth 0 on <connector> is ignored; expected >0.',
      '<Connector> from="5" names no layer.'
    ])
    const connector = getNodeOrThrow(graph, graph.getChildren(result.id)[1].id)
    const line = connectorSublayers(graph, connector)?.line
    expect(line?.strokeWeight).toBe(4)
    expect(connector.connectorEnd?.nodeId).toBe(graph.getChildren(result.id)[0].id)
  })

  test('name the rendered roots too, not only the layers inside them', async () => {
    const graph = new SceneGraph()
    const [flow] = await renderJSX(
      graph,
      `<Frame name="Flow" w={800} h={400}>
        <Frame name="Step" x={300} y={100} w={100} h={100} />
        <Connector from="Flow" to="Step" />
      </Frame>`
    )
    expect(flow.warnings ?? []).toEqual([])
    const connector = getNodeOrThrow(graph, graph.getChildren(flow.id)[1].id)
    expect(connector.connectorStart?.nodeId).toBe(flow.id)
  })

  test('write back their name, visibility, and opacity', async () => {
    const graph = new SceneGraph()
    const jsx = `<Frame name="Flow" w={800} h={400}>
      <Frame name="A" x={0} y={0} w={100} h={100} />
      <Frame name="B" x={400} y={0} w={100} h={100} />
      <Connector name="Hidden" from="A" to="B" opacity={0.5} visible={false} />
    </Frame>`
    const [result] = await renderJSX(graph, jsx)
    expect(sceneNodeToJSX(result.id, graph)).toContain(
      '<Connector name="Hidden" from="A" to="B" opacity={0.5} visible={false} />'
    )
  })

  test('style and bind their line by the variables their stroke props name', async () => {
    const graph = new SceneGraph()
    graph.addCollection({
      id: 'colors',
      name: 'Colors',
      modes: [{ modeId: 'light', name: 'Light' }],
      defaultModeId: 'light',
      variableIds: []
    })
    graph.addVariable({
      id: 'var-line',
      name: 'Line',
      type: 'COLOR',
      collectionId: 'colors',
      valuesByMode: { light: { r: 1, g: 0, b: 0, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })
    const [result] = await renderJSX(
      graph,
      `<Frame name="Flow" w={800} h={400}>
        <Frame name="A" x={0} y={0} w={100} h={100} />
        <Frame name="B" x={400} y={0} w={100} h={100} />
        <Connector from="A" to="B" stroke={designVar('var-line')} />
      </Frame>`
    )
    const connector = getNodeOrThrow(graph, graph.getChildren(result.id)[2].id)
    const line = connectorSublayers(graph, connector)?.line
    expect(line?.strokes[0]?.color).toMatchObject({ r: 1, g: 0, b: 0 })
    expect(line?.boundVariables['strokes/0/color']).toBe('var-line')
  })
})

test('a connector label styled in ranges writes back with <Span>s', async () => {
  const graph = new SceneGraph()
  const [flow] = await renderJSX(
    graph,
    `<Frame name="Flow" w={400} h={200}>
      <Frame name="A" w={50} h={50} />
      <Frame name="B" x={300} w={50} h={50} />
      <Connector from="A" to="B"><Span italic>maybe</Span> later</Connector>
    </Frame>`
  )
  const connector = graph.getChildren(flow.id).find((node) => node.type === 'CONNECTOR')
  if (!connector) throw new Error('Expected the connector')
  expect(connectorSublayers(graph, connector)?.label.styleRuns).toEqual([
    { start: 0, length: 5, style: { italic: true } }
  ])
  expect(sceneNodeToJSX(flow.id, graph)).toContain('><Span italic>maybe</Span> later</Connector>')
})
