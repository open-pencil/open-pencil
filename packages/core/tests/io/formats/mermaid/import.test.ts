import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'
import { connectorSublayers } from '@open-pencil/scene-graph/connectors'
import { getAxisAlignedBoundsInParent } from '@open-pencil/scene-graph/coordinate'
import { shapeWithTextLabel } from '@open-pencil/scene-graph/generated'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { BUILTIN_IO_FORMATS, IORegistry } from '#core/io'

const io = new IORegistry(BUILTIN_IO_FORMATS)

async function read(source: string, name = 'flow.mmd') {
  const { graph } = await io.readDocument({ name, data: new TextEncoder().encode(source) })
  return graph
}

function page(graph: SceneGraph): SceneNode {
  return expectDefined(graph.getPages()[0])
}

function shapes(graph: SceneGraph): SceneNode[] {
  return [...graph.getAllNodes()].filter((node) => node.type === 'SHAPE_WITH_TEXT')
}

function named(graph: SceneGraph, name: string): SceneNode {
  return expectDefined(
    [...graph.getAllNodes()].find((node) => node.name === name),
    name
  )
}

function labelOf(graph: SceneGraph, node: SceneNode): string {
  return shapeWithTextLabel(graph, node)?.text ?? connectorSublayers(graph, node)?.label.text ?? ''
}

function connectors(graph: SceneGraph): SceneNode[] {
  return [...graph.getAllNodes()].filter((node) => node.type === 'CONNECTOR')
}

/** A layer's box on the page. */
function box(graph: SceneGraph, node: SceneNode): Rect {
  return getAxisAlignedBoundsInParent([node], page(graph).id, graph)
}

function overlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}

const CHECKOUT = `---
title: Checkout
---
flowchart TD
  A[Start] --> B{Cart empty?}
  B -- Yes --> C(Suggest items)
  B -->|No| D[[Collect payment]]
  subgraph F [Fulfilment]
    D --> E[(Orders)]
    subgraph W [Warehouse]
      E --> G((Shipped))
    end
  end
  C -.-> A
  C ==> G
  G ~~~ A`

describe('opening Mermaid files', () => {
  test('a Markdown label draws its emphasis as ranges of its text', async () => {
    const graph = await read('flowchart LR\n  a["`**Ship** _it_`"] -->|"`**go**`"| b')
    const label = shapeWithTextLabel(graph, named(graph, 'Ship it'))
    expect(label?.text).toBe('Ship it')
    expect(label?.styleRuns).toEqual([
      { start: 0, length: 4, style: { fontWeight: 700 } },
      { start: 5, length: 2, style: { italic: true } }
    ])
    const edge = expectDefined(connectorSublayers(graph, connectors(graph)[0])?.label)
    expect(edge.text).toBe('go')
    expect(edge.styleRuns).toEqual([{ start: 0, length: 2, style: { fontWeight: 700 } }])
  })

  test('takes .mmd and .mermaid files and refuses diagrams other than flowcharts', async () => {
    const format = expectDefined(io.getFormat('mermaid'))
    expect(format.matchesFile?.('flow.mmd')).toBe(true)
    expect(format.matchesFile?.('flow.mermaid')).toBe(true)
    expect(format.matchesFile?.('flow.md')).toBe(false)
    await expect(read('sequenceDiagram\nA->>B: hi')).rejects.toThrow('no Mermaid flowchart')
  })

  test('makes a page named after the title, with a shape per node and a section per subgraph', async () => {
    const graph = await read(CHECKOUT)
    expect(page(graph).name).toBe('Checkout')
    const kinds = Object.fromEntries(
      shapes(graph).map((shape) => [labelOf(graph, shape), shape.shapeWithTextType])
    )
    expect(kinds).toEqual({
      Start: 'SQUARE',
      'Cart empty?': 'DIAMOND',
      'Suggest items': 'ROUNDED_RECTANGLE',
      'Collect payment': 'PREDEFINED_PROCESS',
      Orders: 'ENG_DATABASE',
      Shipped: 'ELLIPSE'
    })
    const fulfilment = named(graph, 'Fulfilment')
    const warehouse = named(graph, 'Warehouse')
    expect(fulfilment.type).toBe('SECTION')
    expect(warehouse.parentId).toBe(fulfilment.id)
    // A node belongs to the subgraph that closes first, as in Mermaid.
    expect(named(graph, 'Collect payment').parentId).toBe(fulfilment.id)
    expect(named(graph, 'Orders').parentId).toBe(warehouse.id)
    expect(named(graph, 'Shipped').parentId).toBe(warehouse.id)
    expect(named(graph, 'Start').parentId).toBe(page(graph).id)
  })

  test('lays the chart out along its direction without overlaps, sections around their members', async () => {
    const graph = await read(CHECKOUT)
    const boxes = shapes(graph).map((shape) => box(graph, shape))
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) expect(overlap(a, b)).toBe(false)
    }
    const start = box(graph, named(graph, 'Start'))
    const decision = box(graph, named(graph, 'Cart empty?'))
    expect(start.y + start.height).toBeLessThan(decision.y)
    expect(
      contains(box(graph, named(graph, 'Fulfilment')), box(graph, named(graph, 'Collect payment')))
    ).toBe(true)
    expect(
      contains(box(graph, named(graph, 'Warehouse')), box(graph, named(graph, 'Shipped')))
    ).toBe(true)

    const across = await read('flowchart LR\n  A --> B')
    const [a, b] = ['A', 'B'].map((name) => box(across, named(across, name)))
    expect(expectDefined(a).x + expectDefined(a).width).toBeLessThan(expectDefined(b).x)
  })

  test('joins a connector per drawn edge to its layers by the sides the flow takes', async () => {
    const graph = await read(CHECKOUT)
    const lines = connectors(graph)
    // `~~~` lays the chart out but draws nothing.
    expect(lines).toHaveLength(7)
    const joined = (from: string, to: string) =>
      expectDefined(
        lines.find(
          (line) =>
            line.connectorStart?.nodeId === named(graph, from).id &&
            line.connectorEnd?.nodeId === named(graph, to).id
        ),
        `${from} → ${to}`
      )
    const first = joined('Start', 'Cart empty?')
    expect([first.connectorStart?.magnet, first.connectorEnd?.magnet]).toEqual(['BOTTOM', 'TOP'])
    expect(first.connectorLineType).toBe('ELBOWED')
    expect([first.connectorStartCap, first.connectorEndCap]).toEqual(['NONE', 'ARROW_EQUILATERAL'])
    expect(labelOf(graph, joined('Cart empty?', 'Suggest items'))).toBe('Yes')
    expect(labelOf(graph, joined('Cart empty?', 'Collect payment'))).toBe('No')

    const lineOf = (connector: SceneNode) =>
      expectDefined(connectorSublayers(graph, connector)).line
    const plain = lineOf(first)
    const dotted = lineOf(joined('Suggest items', 'Start'))
    const thick = lineOf(joined('Suggest items', 'Shipped'))
    expect(plain.dashPattern).toEqual([])
    expect(dotted.dashPattern.length).toBeGreaterThan(0)
    expect(thick.strokeWeight).toBeGreaterThan(plain.strokeWeight)
  })

  test('carries classDef, class, style, and linkStyle colours over', async () => {
    const graph = await read(`flowchart LR
      A:::hot --> B --> C
      classDef hot fill:#ffd6a5,stroke:#e85d04,color:#7a2e00
      classDef default fill:#eeeeee
      style B stroke:#2a9d8f,stroke-width:2px
      linkStyle 1 stroke:#ff0000`)
    const a = named(graph, 'A')
    const b = named(graph, 'B')
    expect(colorToHex(expectDefined(a.fills[0]).color)).toBe('#FFD6A5')
    expect(colorToHex(expectDefined(a.strokes[0]).color)).toBe('#E85D04')
    expect(colorToHex(expectDefined(shapeWithTextLabel(graph, a)?.fills[0]).color)).toBe('#7A2E00')
    expect(colorToHex(expectDefined(b.fills[0]).color)).toBe('#EEEEEE')
    expect(b.strokes[0]).toMatchObject({ weight: 2 })
    const second = expectDefined(
      connectors(graph).find((line) => line.connectorStart?.nodeId === b.id)
    )
    const line = expectDefined(connectorSublayers(graph, second)).line
    expect(colorToHex(expectDefined(line.strokes[0]).color)).toBe('#FF0000')
  })
})
