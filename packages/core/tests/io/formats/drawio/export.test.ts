import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import { expectDefined } from '#core-tests/helpers/assert'

import { BUILTIN_IO_FORMATS, IORegistry } from '#core/io'

import { parseDrawioFile } from '@open-pencil/drawio'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { connectorSublayers, createConnector, freeEndpoint } from '@open-pencil/scene-graph/connectors'

const io = new IORegistry(BUILTIN_IO_FORMATS)

/** A flowchart as draw.io saves it: shapes, text, elbowed, dashed, bent, and curved edges. */
const ORDER_FLOW = readFileSync(new URL('order-flow.drawio', import.meta.url), 'utf8')

async function read(source: string) {
  return (await io.readDocument({ name: 'flow.drawio', data: new TextEncoder().encode(source) })).graph
}

async function write(graph: SceneGraph): Promise<string> {
  const format = expectDefined(io.getFormat('drawio'))
  const result = expectDefined(await format.writeDocument?.(graph))
  if (typeof result.data !== 'string') throw new Error('Expected draw.io XML')
  return result.data
}

/** What a page holds, as a round trip should keep it. */
function summary(graph: SceneGraph) {
  const page = graph.getPages()[0]
  const name = (id: string | null | undefined) => (id ? graph.getNode(id)?.name : null)
  return graph.getChildren(page.id).map((node: SceneNode) =>
    node.type === 'CONNECTOR'
      ? {
          type: node.type,
          lineType: node.connectorLineType,
          from: name(node.connectorStart?.nodeId),
          to: name(node.connectorEnd?.nodeId),
          caps: [node.connectorStartCap, node.connectorEndCap],
          label: connectorSublayers(graph, node)?.label.text
        }
      : {
          type: node.type,
          kind: node.shapeWithTextType,
          name: node.name,
          box: [node.x, node.y, node.width, node.height].map(Math.round),
          fill: node.fills[0]?.type === 'SOLID' ? node.fills[0].color : null
        }
  )
}

describe('saving a draw.io file', () => {
  test('a diagram opened from draw.io saves to one that opens the same', async () => {
    const opened = await read(ORDER_FLOW)
    const saved = await write(opened)
    expect(saved).toStartWith('<mxfile host="OpenPencil">')
    expect(summary(await read(saved))).toEqual(summary(opened))
  })

  test('a dragged connector saves the corners it was dragged to, which draw.io runs through', async () => {
    const opened = await read(ORDER_FLOW)
    const file = expectDefined(parseDrawioFile(await write(opened)))
    const bent = expectDefined(file.pages[0]?.cells.find((cell) => cell.value === 'no'))
    expect(bent.geometry.points).toContainEqual({ x: 420, y: 160 })
    expect(bent.geometry.points).toContainEqual({ x: 530, y: 160 })
    expect(bent.style.values.edgeStyle).toBe('orthogonalEdgeStyle')
  })

  test('a layer draw.io has no cell for goes as an SVG image of itself', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.createNode('STAR', page.id, {
      name: 'Star',
      x: 10,
      y: 20,
      width: 40,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0.8, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    const connector = createConnector(graph, page.id, {
      start: freeEndpoint(100, 100),
      end: freeEndpoint(300, 100)
    })
    graph.updateNode(connector.id, { name: 'Loose' })
    const [star, edge] = expectDefined(parseDrawioFile(await write(graph))).pages[0]?.cells ?? []
    expect(star.style.values.shape).toBe('image')
    expect(star.style.values.image).toStartWith('data:image/svg+xml,')
    expect(star.geometry).toMatchObject({ x: 10, y: 20, width: 40, height: 40 })
    // A free connector keeps its ends as points.
    expect(edge.geometry).toMatchObject({ sourcePoint: { x: 100, y: 100 }, targetPoint: { x: 300, y: 100 } })
  })
})
