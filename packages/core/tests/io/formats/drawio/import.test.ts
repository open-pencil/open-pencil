import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { BUILTIN_IO_FORMATS, IORegistry } from '#core/io'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { connectorSublayers } from '@open-pencil/scene-graph/connectors'
import { shapeWithTextLabel } from '@open-pencil/scene-graph/generated'

const io = new IORegistry(BUILTIN_IO_FORMATS)

/** A draw.io file whose first page holds `cells` on draw.io's default layer. */
function file(cells: string, layers = '<mxCell id="1" parent="0"/>') {
  return `<mxfile><diagram id="p" name="Flow"><mxGraphModel><root><mxCell id="0"/>${layers}${cells}</root></mxGraphModel></diagram></mxfile>`
}

const vertex = (id: string, style: string, [x, y, w, h]: number[], value = '', parent = '1') =>
  `<mxCell id="${id}" value="${value}" style="${style}" vertex="1" parent="${parent}"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`

async function read(source: string, name = 'flow.drawio') {
  const { graph } = await io.readDocument({ name, data: new TextEncoder().encode(source) })
  return graph
}

function onPage(graph: SceneGraph): SceneNode[] {
  return graph.getChildren(graph.getPages()[0].id)
}

function byName(graph: SceneGraph, name: string): SceneNode {
  return expectDefined([...graph.getAllNodes()].find((node) => node.name === name), name)
}

describe('opening draw.io files', () => {
  test('takes .drawio and .dio files and draw.io’s editable PNG and SVG exports', () => {
    const format = expectDefined(io.getFormat('drawio'))
    for (const name of ['flow.drawio', 'flow.dio', 'flow.drawio.png', 'flow.drawio.svg']) {
      expect({ name, matches: format.matchesFile?.(name) }).toEqual({ name, matches: true })
    }
    expect(format.matchesFile?.('photo.png')).toBe(false)
  })

  test('refuses a file with no diagram, and one with pages it cannot read', async () => {
    await expect(read('<svg xmlns="http://www.w3.org/2000/svg"/>', 'a.drawio.svg')).rejects.toThrow(
      'no draw.io diagram'
    )
    await expect(
      read(`<mxfile><diagram id="x" name="Broken">%%%</diagram></mxfile>`)
    ).rejects.toThrow('Broken')
  })
})

describe('draw.io shapes', () => {
  test('become FigJam shapes with text of the same kind, sized and painted as drawn', async () => {
    const graph = await read(
      file(
        vertex('a', 'rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;strokeWidth=2;', [40, 60, 120, 60], 'Start') +
          vertex('b', 'rhombus;whiteSpace=wrap;html=1;fillColor=none;dashed=1;', [280, 40, 100, 100], '&lt;b&gt;Ok&lt;/b&gt;?') +
          vertex('c', 'shape=cylinder3;whiteSpace=wrap;html=1;', [280, 240, 80, 100], 'Store') +
          vertex('d', 'shape=mxgraph.aws4.lambda;', [600, 40, 60, 60], 'Lambda')
      )
    )
    expect(
      onPage(graph).map((node) => [node.type, node.shapeWithTextType, node.x, node.y, node.width, node.height])
    ).toEqual([
      ['SHAPE_WITH_TEXT', 'ROUNDED_RECTANGLE', 40, 60, 120, 60],
      ['SHAPE_WITH_TEXT', 'DIAMOND', 280, 40, 100, 100],
      ['SHAPE_WITH_TEXT', 'ENG_DATABASE', 280, 240, 80, 100],
      // A stencil FigJam has no shape for draws as a rectangle named after it.
      ['SHAPE_WITH_TEXT', 'SQUARE', 600, 40, 60, 60]
    ])
    const [start, decision, , stencil] = onPage(graph)
    expect(start.fills[0]?.color).toMatchObject({ r: 0xda / 255, g: 0xe8 / 255, b: 0xfc / 255 })
    expect(start.strokes[0]).toMatchObject({ weight: 2, color: { r: 0x6c / 255 } })
    expect(decision.fills).toEqual([])
    expect(decision.dashPattern).toEqual([3, 3])
    expect(stencil.name).toBe('mxgraph.aws4.lambda')
    const label = expectDefined(shapeWithTextLabel(graph, decision))
    expect(label).toMatchObject({ text: 'Ok?', fontSize: 12, fontFamily: 'Inter' })
    expect(label.styleRuns).toEqual([{ start: 0, length: 2, style: { fontWeight: 700 } }])
  })

  test('a triangle points the way draw.io points it', async () => {
    const graph = await read(
      file(
        vertex('r', 'triangle;whiteSpace=wrap;', [500, 40, 60, 80]) +
          vertex('s', 'triangle;direction=south;', [600, 40, 80, 60])
      )
    )
    const [right, down] = onPage(graph)
    // Turned a quarter about the centre of the box it fills.
    expect([right.shapeWithTextType, right.rotation, right.x, right.y, right.width, right.height]).toEqual(['TRIANGLE_UP', 90, 490, 50, 80, 60])
    expect([down.shapeWithTextType, down.rotation]).toEqual(['TRIANGLE_DOWN', 0])
  })

  test('text stays text, and a swimlane is a section around its cells', async () => {
    const graph = await read(
      file(
        vertex('t', 'text;html=1;align=left;verticalAlign=top;fontSize=20;fontColor=#ff0000;', [40, 20, 200, 30], 'Title') +
          vertex('lane', 'swimlane;whiteSpace=wrap;html=1;', [40, 100, 300, 200], 'Team') +
          vertex('in', 'whiteSpace=wrap;html=1;', [20, 40, 100, 50], 'Task', 'lane')
      )
    )
    const title = byName(graph, 'Title')
    expect(title).toMatchObject({ type: 'TEXT', text: 'Title', fontSize: 20, textAlignHorizontal: 'LEFT', textAlignVertical: 'TOP' })
    expect(title.fills[0]?.color).toMatchObject({ r: 1, g: 0, b: 0 })
    const lane = byName(graph, 'Team')
    expect(lane).toMatchObject({ type: 'SECTION', x: 40, y: 100, width: 300, height: 200 })
    expect(graph.getChildren(lane.id).map((node) => [node.name, node.x, node.y])).toEqual([['Task', 20, 40]])
  })
})

describe('draw.io edges', () => {
  const shapes =
    vertex('a', 'whiteSpace=wrap;', [40, 60, 120, 60], 'A') +
    vertex('b', 'whiteSpace=wrap;', [400, 60, 120, 60], 'B') +
    vertex('c', 'whiteSpace=wrap;', [400, 260, 120, 60], 'C')

  test('become connectors joined to their shapes, with draw.io’s line, ends, and label', async () => {
    const graph = await read(
      file(
        shapes +
          `<mxCell id="e" value="goes" style="edgeStyle=orthogonalEdgeStyle;endArrow=open;startArrow=oval;strokeColor=#ff0000;strokeWidth=2;dashed=1;" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry"/></mxCell>` +
          `<mxCell id="f" value="" style="endArrow=block;endFill=0;exitX=1;exitY=0.25;entryX=0;entryY=0.5;" edge="1" parent="1" source="a" target="c"><mxGeometry relative="1" as="geometry"/></mxCell>` +
          `<mxCell id="g" value="" style="curved=1;" edge="1" parent="1" source="b"><mxGeometry relative="1" as="geometry"><mxPoint x="700" y="300" as="targetPoint"/></mxGeometry></mxCell>`
      )
    )
    const [goes, exits, loose] = onPage(graph).filter((node) => node.type === 'CONNECTOR')
    expect(goes).toMatchObject({
      connectorLineType: 'ELBOWED',
      connectorStartCap: 'CIRCLE_FILLED',
      connectorEndCap: 'ARROW_LINES',
      connectorStart: { nodeId: byName(graph, 'A').id, magnet: 'AUTO' },
      connectorEnd: { nodeId: byName(graph, 'B').id, magnet: 'AUTO' }
    })
    const parts = expectDefined(connectorSublayers(graph, goes))
    expect(parts.label.text).toBe('goes')
    expect(parts.line.strokes[0]).toMatchObject({ weight: 2, color: { r: 1, g: 0, b: 0 }, dashPattern: [6, 6] })
    // exitX/exitY pin an end to a point of its shape; an unfilled triangle is an open arrow.
    expect(exits).toMatchObject({
      connectorLineType: 'STRAIGHT',
      connectorEndCap: 'ARROW_LINES',
      connectorStart: { magnet: 'NONE', position: { x: 120, y: 15 } },
      connectorEnd: { magnet: 'NONE', position: { x: 0, y: 30 } }
    })
    // draw.io's default arrowhead is a filled triangle, FigJam's triangle arrow.
    expect(loose).toMatchObject({
      connectorLineType: 'CURVED',
      connectorEndCap: 'ARROW_EQUILATERAL',
      connectorEnd: { nodeId: null, position: { x: 700, y: 300 } }
    })
  })

  test('bent through points leave and enter by the sides facing them and run through them', async () => {
    const graph = await read(
      file(
        shapes +
          `<mxCell id="e" style="edgeStyle=orthogonalEdgeStyle;" edge="1" parent="1" source="b" target="c"><mxGeometry relative="1" as="geometry"><Array as="points"><mxPoint x="600" y="90"/><mxPoint x="600" y="290"/></Array></mxGeometry></mxCell>`
      )
    )
    const connector = expectDefined(onPage(graph).find((node) => node.type === 'CONNECTOR'))
    expect([connector.connectorStart?.magnet, connector.connectorEnd?.magnet]).toEqual(['RIGHT', 'RIGHT'])
    const { line } = expectDefined(connectorSublayers(graph, connector))
    const points = (line.vectorNetwork?.vertices ?? []).map((v) => [connector.x + line.x + v.x, connector.y + line.y + v.y])
    expect(points.some(([x]) => x === 600)).toBe(true)
    expect(points.at(0)?.[0]).toBeGreaterThan(520)
  })

  test('take the labels draw.io keeps along them, where it keeps them', async () => {
    const graph = await read(
      file(
        shapes +
          `<mxCell id="e" value="" style="" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry"/></mxCell>` +
          `<mxCell id="l1" value="first" style="edgeLabel;html=1;" vertex="1" connectable="0" parent="e"><mxGeometry x="-0.5" relative="1" as="geometry"/></mxCell>` +
          `<mxCell id="l2" value="second" style="edgeLabel;html=1;" vertex="1" connectable="0" parent="e"><mxGeometry x="0.5" relative="1" as="geometry"/></mxCell>`
      )
    )
    const connector = expectDefined(onPage(graph).find((node) => node.type === 'CONNECTOR'))
    expect(connector.connectorLabelPosition).toEqual({ section: 'MIDDLE_TO_START', offset: 0.5, offAxis: 'NONE' })
    expect(connectorSublayers(graph, connector)?.label.text).toBe('first')
    // A second label draws as text by the edge.
    expect(byName(graph, 'second').type).toBe('TEXT')
  })
})

describe('draw.io pages and layers', () => {
  test('each page is a page, each of several layers a group, in draw.io’s order', async () => {
    const graph = await read(
      `<mxfile><diagram id="p1" name="One"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="Notes" parent="0" visible="0"/>${vertex('a', '', [0, 0, 50, 50], 'Below')}${vertex('b', '', [100, 0, 50, 50], 'Hidden note', '2')}${vertex('c', '', [200, 0, 50, 50], 'Above')}</root></mxGraphModel></diagram><diagram id="p2" name="Two"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`
    )
    expect(graph.getPages().map((page) => page.name)).toEqual(['One', 'Two'])
    const [base, notes] = onPage(graph)
    expect([base.type, base.name, notes.type, notes.name, notes.visible]).toEqual(['GROUP', 'Layer 1', 'GROUP', 'Notes', false])
    expect(graph.getChildren(base.id).map((node) => node.name)).toEqual(['Below', 'Above'])
    expect(graph.getChildren(notes.id).map((node) => node.name)).toEqual(['Hidden note'])
  })
})
