import { describe, expect, test } from 'bun:test'

import { reconcileRenderedLayers } from '#design-jsx/index'

import { SceneGraph, type NodeType, type SceneNode } from '@open-pencil/scene-graph'

interface Layer {
  type: NodeType
  name: string
  width?: number
  children?: Layer[]
}

/** Builds layers the way a render leaves them: a fresh subtree under the page. */
function build(graph: SceneGraph, layer: Layer, parentId = graph.getPages()[0].id): string {
  const node = graph.createNode(layer.type, parentId, {
    name: layer.name,
    width: layer.width ?? 10
  })
  for (const child of layer.children ?? []) build(graph, child, node.id)
  return node.id
}

function children(graph: SceneGraph, id: string): SceneNode[] {
  return graph.getChildren(id)
}

describe('reconcileRenderedLayers', () => {
  test('updates matched layers in place and keeps their ids', () => {
    const graph = new SceneGraph()
    const before = build(graph, {
      type: 'FRAME',
      name: 'Card',
      width: 200,
      children: [{ type: 'RECTANGLE', name: 'Swatch', width: 40 }]
    })
    const swatchId = children(graph, before)[0].id
    const after = build(graph, {
      type: 'FRAME',
      name: 'Card',
      width: 320,
      children: [{ type: 'RECTANGLE', name: 'Swatch', width: 80 }]
    })

    const { rootIds, ids } = reconcileRenderedLayers(graph, [before], [after])

    expect(rootIds).toEqual([before])
    expect(graph.getNode(after)).toBeUndefined()
    expect(graph.getNode(before)?.width).toBe(320)
    expect(children(graph, before).map((child) => [child.id, child.width])).toEqual([
      [swatchId, 80]
    ])
    expect(ids.get(after)).toBe(before)
  })

  test('adds, removes and reorders children to match the code', () => {
    const graph = new SceneGraph()
    const before = build(graph, {
      type: 'FRAME',
      name: 'List',
      children: [
        { type: 'RECTANGLE', name: 'A' },
        { type: 'RECTANGLE', name: 'B' },
        { type: 'RECTANGLE', name: 'C' }
      ]
    })
    const [a, , c] = children(graph, before).map((child) => child.id)
    const after = build(graph, {
      type: 'FRAME',
      name: 'List',
      children: [
        { type: 'RECTANGLE', name: 'C' },
        { type: 'ELLIPSE', name: 'New' },
        { type: 'RECTANGLE', name: 'A' }
      ]
    })

    reconcileRenderedLayers(graph, [before], [after])

    expect(children(graph, before).map((child) => child.name)).toEqual(['C', 'New', 'A'])
    const [first, , last] = children(graph, before).map((child) => child.id)
    expect([first, last]).toEqual([c, a])
  })

  test('replaces a layer whose type changed', () => {
    const graph = new SceneGraph()
    const before = build(graph, {
      type: 'FRAME',
      name: 'Card',
      children: [{ type: 'RECTANGLE', name: 'Dot' }]
    })
    const after = build(graph, {
      type: 'FRAME',
      name: 'Card',
      children: [{ type: 'ELLIPSE', name: 'Dot' }]
    })

    const { ids } = reconcileRenderedLayers(graph, [before], [after])

    const [dot] = children(graph, before)
    expect(dot.type).toBe('ELLIPSE')
    expect([...ids.values()]).toContain(dot.id)
  })

  test('keeps extra rendered roots and deletes missing ones', () => {
    const graph = new SceneGraph()
    const one = build(graph, { type: 'FRAME', name: 'One' })
    const two = build(graph, { type: 'FRAME', name: 'Two' })
    const next = build(graph, { type: 'FRAME', name: 'One again' })

    const { rootIds } = reconcileRenderedLayers(graph, [one, two], [next])

    expect(rootIds).toEqual([one])
    expect(graph.getNode(one)?.name).toBe('One again')
    expect(graph.getNode(two)).toBeUndefined()
  })

  test('points rendered instances and connectors at the layers kept in place', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const render = () => {
      const card = graph.createNode('COMPONENT', page, { name: 'Card' })
      const copy = graph.createNode('INSTANCE', page, { name: 'Card copy', componentId: card.id })
      const end = (nodeId: string) => ({
        nodeId,
        magnet: 'AUTO' as const,
        position: { x: 0, y: 0 }
      })
      const link = graph.createNode('CONNECTOR', page, {
        name: 'Link',
        connectorStart: end(card.id),
        connectorEnd: end(copy.id)
      })
      return [card.id, copy.id, link.id]
    }
    const before = render()
    const after = render()

    const { rootIds } = reconcileRenderedLayers(graph, before, after)

    const [card, copy, link] = rootIds.map((id) => graph.getNode(id))
    expect(card?.id).toBe(before[0])
    expect(copy?.componentId).toBe(card?.id)
    expect([link?.connectorStart?.nodeId, link?.connectorEnd?.nodeId]).toEqual([card?.id, copy?.id])
  })
})
