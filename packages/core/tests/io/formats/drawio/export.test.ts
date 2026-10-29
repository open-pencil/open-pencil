import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import { expectDefined } from '#core-tests/helpers/assert'

import { parseDrawIOFile } from '@open-pencil/drawio'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import {
  boundEndpoint,
  connectorSublayers,
  createConnector,
  freeEndpoint
} from '@open-pencil/scene-graph/connectors'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import { createShapeWithText } from '@open-pencil/scene-graph/generated'
import Matrix from '@open-pencil/scene-graph/matrix'

import { BUILTIN_IO_FORMATS, IORegistry } from '#core/io'
import type { ExportTarget } from '#core/io'

const io = new IORegistry(BUILTIN_IO_FORMATS)

/** A flowchart as draw.io saves it: shapes, text, elbowed, dashed, bent, and curved edges. */
const ORDER_FLOW = readFileSync(new URL('order-flow.drawio', import.meta.url), 'utf8')

async function read(source: string) {
  return (await io.readDocument({ name: 'flow.drawio', data: new TextEncoder().encode(source) }))
    .graph
}

async function write(graph: SceneGraph): Promise<string> {
  const format = expectDefined(io.getFormat('drawio'))
  const result = expectDefined(await format.writeDocument?.(graph))
  if (typeof result.data !== 'string') throw new Error('Expected draw.io XML')
  return result.data
}

/** The cells a draw.io export of `target` writes on its one page. */
async function exported(graph: SceneGraph, target: ExportTarget) {
  const result = await io.exportContent('drawio', { graph, target })
  if (typeof result.data !== 'string') throw new Error('Expected draw.io XML')
  const file = expectDefined(parseDrawIOFile(result.data))
  return expectDefined(file.pages[0]).cells
}

/** A page with a rectangle and, in a group at 100, 100, a shape and a connector out of it. */
function grouped() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const rect = graph.createNode('RECTANGLE', page.id, { name: 'Alone', width: 40, height: 40 })
  const group = graph.createNode('GROUP', page.id, {
    name: 'Group',
    x: 100,
    y: 100,
    width: 200,
    height: 100
  })
  const shape = createShapeWithText(
    graph,
    group.id,
    { name: 'Inner', x: 10, y: 20, width: 60, height: 40 },
    {}
  )
  const connector = createConnector(graph, group.id, {
    start: boundEndpoint(shape.id, 'RIGHT'),
    end: freeEndpoint(180, 40)
  })
  return { graph, page, rect, group, shape, connector }
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
    const file = expectDefined(parseDrawIOFile(await write(opened)))
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
    const [star, edge] = expectDefined(parseDrawIOFile(await write(graph))).pages[0]?.cells ?? []
    expect(star.style.values.shape).toBe('image')
    expect(star.style.values.image).toStartWith('data:image/svg+xml,')
    expect(star.geometry).toMatchObject({ x: 10, y: 20, width: 40, height: 40 })
    // A free connector keeps its ends as points.
    expect(edge.geometry).toMatchObject({
      sourcePoint: { x: 100, y: 100 },
      targetPoint: { x: 300, y: 100 }
    })
  })

  test('turned rectangles, ellipses, and text keep their turn', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.createNode('RECTANGLE', page.id, { width: 40, height: 20, rotation: 30 })
    graph.createNode('ELLIPSE', page.id, { width: 40, height: 20, rotation: -45 })
    graph.createNode('TEXT', page.id, { width: 40, height: 20, rotation: 15, text: 'Turned' })
    const cells = expectDefined(parseDrawIOFile(await write(graph))).pages[0]?.cells ?? []
    expect(cells.map((cell) => cell.style.values.rotation)).toEqual(['30', '-45', '15'])
  })

  test('turned and mirrored layers, also in a turned and mirrored group, open where they were', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const group = graph.createNode('GROUP', page.id, {
      x: 100,
      y: 80,
      width: 300,
      height: 200,
      rotation: 30,
      flipX: true
    })
    const shapes = [
      { text: 'Up', shapeWithTextType: 'TRIANGLE_UP', rotation: 20, flipY: true },
      { text: 'Quarter', shapeWithTextType: 'TRIANGLE_UP', rotation: 90 },
      { text: 'Left', shapeWithTextType: 'PARALLELOGRAM_LEFT', rotation: -10, flipX: true },
      { text: 'Both', shapeWithTextType: 'DIAMOND', rotation: 45, flipX: true, flipY: true }
    ] as const
    for (const [index, { text, ...fields }] of shapes.entries()) {
      const at = { x: 20 + index * 70, y: 30, width: 60, height: 40 }
      createShapeWithText(graph, page.id, { ...at, ...fields, name: text }, { text })
      const name = `${text} grouped`
      createShapeWithText(graph, group.id, { ...at, ...fields, name }, { text: name })
    }
    graph.createNode('TEXT', group.id, {
      name: 'Note',
      x: 10,
      y: 120,
      width: 80,
      height: 20,
      text: 'Note'
    })
    graph.createNode('TEXT', page.id, {
      x: 300,
      y: 300,
      width: 80,
      height: 20,
      rotation: 15,
      flipX: true,
      name: 'Mirrored',
      text: 'Mirrored'
    })

    /** Where each named layer's corners land on the page, in its own order. */
    const corners = (of: SceneGraph) =>
      Object.fromEntries(
        [...of.getAllNodes()]
          .filter((node) => node.type === 'SHAPE_WITH_TEXT' || node.type === 'TEXT')
          // A shape's label goes with its shape.
          .filter((node) => of.getNode(node.parentId ?? '')?.type !== 'SHAPE_WITH_TEXT')
          .map((node) => [
            node.name,
            Matrix.mapPoints(getWorldMatrix(node, of), [
              0,
              0,
              node.width,
              0,
              node.width,
              node.height,
              0,
              node.height
            ]).map((n) => Math.round(n * 10) / 10)
          ])
      )
    const opened = await read(await write(graph))
    const { Left: left, ...before } = corners(graph)
    const { Left: reopened, ...after } = corners(opened)
    expect(Object.keys(before)).toHaveLength(9)
    expect(after).toEqual(before)
    // A mirrored left parallelogram is a right one.
    const right = [...opened.getAllNodes()].find((node) => node.name === 'Left')
    expect(right?.shapeWithTextType).toBe('PARALLELOGRAM_RIGHT')
    const points = (flat: number[] = []) =>
      flat.flatMap((n, i) => (i % 2 ? [] : [`${n},${flat[i + 1]}`])).toSorted()
    expect(points(reopened)).toEqual(points(left))
  })

  test('non-rectangular shapes name the outline edges attach to', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    for (const shapeWithTextType of ['ELLIPSE', 'DIAMOND', 'TRIANGLE_UP', 'HEXAGON'] as const) {
      createShapeWithText(graph, page.id, { shapeWithTextType, width: 60, height: 40 }, {})
    }
    const cells = expectDefined(parseDrawIOFile(await write(graph))).pages[0]?.cells ?? []
    expect(cells.map((cell) => cell.style.values.perimeter)).toEqual([
      'ellipsePerimeter',
      'rhombusPerimeter',
      'trianglePerimeter',
      'hexagonPerimeter2'
    ])
  })
})

describe('exporting part of a design as draw.io', () => {
  test('a page holds that page’s layers, a node only itself', async () => {
    const { graph, page, rect, group } = grouped()
    const other = graph.addPage('Other')
    graph.createNode('RECTANGLE', other.id, { width: 10, height: 10 })
    expect((await exported(graph, { scope: 'page', pageId: page.id })).length).toBeGreaterThan(2)
    const [only, ...rest] = await exported(graph, { scope: 'node', nodeId: rect.id })
    expect([only?.geometry.width, rest.length]).toEqual([40, 0])
    const selected = await exported(graph, { scope: 'selection', nodeIds: [rect.id, group.id] })
    expect(selected.filter((cell) => cell.parent === '1')).toHaveLength(2)
    await expect(exported(graph, { scope: 'selection', nodeIds: [] })).rejects.toThrow(
      'Nothing to export'
    )
  })

  test('layers selected inside a group keep their place on the page', async () => {
    const { graph, shape, connector } = grouped()
    const cells = await exported(graph, { scope: 'selection', nodeIds: [shape.id, connector.id] })
    const [vertex, edge] = cells
    expect(vertex?.geometry).toMatchObject({ x: 110, y: 120, width: 60, height: 40 })
    expect(edge?.geometry.targetPoint).toEqual({ x: 280, y: 140 })
  })

  test('a layer chosen with a group it is in is written once, inside the group', async () => {
    const { graph, group, shape } = grouped()
    const cells = await exported(graph, { scope: 'selection', nodeIds: [group.id, shape.id] })
    const ids = cells.map((cell) => cell.id)
    expect(new Set(ids).size).toBe(ids.length)
    const groupCell = expectDefined(cells.find((cell) => cell.style.names.includes('group')))
    expect(cells.filter((cell) => cell.parent === '1')).toEqual([groupCell])
  })

  test('an edge whose layer is left out keeps that end as a point where its line ran', async () => {
    const { graph, connector } = grouped()
    const [edge] = await exported(graph, { scope: 'selection', nodeIds: [connector.id] })
    expect(edge?.source).toBeNull()
    // Off the shape's right side, 10 + 60 across and 20 + 40 / 2 down in the group at 100, 100,
    // by the gap a joined end leaves.
    expect(edge?.geometry.sourcePoint).toEqual({ x: 176, y: 140 })
  })
})
