import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { captureTouchedCheckpoint } from '@open-pencil/scene-graph/checkpoint'

function pageId(graph: SceneGraph): string {
  return graph.getPages()[0].id
}

/** About `total` layers on the first page: frames of nine rectangles each. */
function largeGraph(total: number) {
  const graph = new SceneGraph()
  const page = pageId(graph)
  const rectangles: string[] = []
  for (let f = 0; f < total / 10; f++) {
    const frame = graph.createNode('FRAME', page)
    for (let r = 0; r < 9; r++) rectangles.push(graph.createNode('RECTANGLE', frame.id).id)
  }
  return { graph, page, rectangles }
}

describe('touched checkpoint', () => {
  test('copies only the reported layer and its ancestors below the page', () => {
    const { graph, rectangles } = largeGraph(12_000)
    expect(graph.nodes.size).toBeGreaterThan(12_000)
    const target = rectangles[5_000]
    const checkpoint = captureTouchedCheckpoint(graph)
    graph.updateNode(target, { opacity: 0.5 })
    checkpoint.assertPropertiesOnly()
    checkpoint.stop()
    // The rectangle and its frame; the page and document are not copied.
    expect(checkpoint.nodes.size).toBe(2)
    expect([...checkpoint.reported]).toEqual([target])
    expect(checkpoint.nodes.get(target)?.opacity).toBe(1)
    expect(graph.getNode(target)?.opacity).toBe(0.5)
  })

  test('a rollback keeps identities, indexes, modes, and node order', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const frame = graph.createNode('FRAME', page)
    const rect = graph.createNode('RECTANGLE', frame.id)
    const component = graph.createNode('COMPONENT', page)
    const instance = graph.createInstance(component.id, page)
    if (!instance) throw new Error('Missing instance')
    const collection = graph.createCollection('Theme')
    const dark = graph.createMode(collection.id, 'Dark')
    if (!dark) throw new Error('Missing mode')
    const order = [...graph.nodes.keys()]
    const nodes = structuredClone(graph.nodes)
    const index = structuredClone(graph.instanceIndex)
    const modes = structuredClone(graph.activeMode)
    const originals = new Map(graph.nodes)

    const checkpoint = captureTouchedCheckpoint(graph)
    graph.updateNode(rect.id, { opacity: 0.25 })
    graph.deleteNode(instance.id)
    graph.reparentNode(rect.id, page)
    graph.setActiveMode(collection.id, dark)
    graph.createNode('ELLIPSE', frame.id)
    expect(() => checkpoint.assertPropertiesOnly()).toThrow('must not create or remove')
    checkpoint.restore()

    expect([...graph.nodes.keys()]).toEqual(order)
    expect(graph.nodes).toEqual(nodes)
    for (const [id, node] of originals) expect(graph.getNode(id)).toBe(node)
    expect(graph.instanceIndex).toEqual(index)
    expect(graph.activeMode).toEqual(modes)
  })

  test('a node event without a report fails the edit', () => {
    const graph = new SceneGraph()
    const rect = graph.createNode('RECTANGLE', pageId(graph))
    const checkpoint = captureTouchedCheckpoint(graph)
    graph.emitter.emit('node:updated', rect.id, {})
    expect(() => checkpoint.assertPropertiesOnly()).toThrow(
      `must report layer changes to the scene graph (SceneGraph.willChangeNode): ${rect.id}`
    )
    checkpoint.stop()
  })

  test('a changed component id fails the edit', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const component = graph.createNode('COMPONENT', page)
    const instance = graph.createInstance(component.id, page)
    if (!instance) throw new Error('Missing instance')
    const checkpoint = captureTouchedCheckpoint(graph)
    graph.updateNode(instance.id, { componentId: null })
    expect(() => checkpoint.assertPropertiesOnly()).toThrow('must not change node hierarchy')
    checkpoint.restore()
    expect(graph.getNode(instance.id)?.componentId).toBe(component.id)
  })

  test('a rollback after an edit replaced a node restores the original as it was', () => {
    const graph = new SceneGraph()
    const rect = graph.createNode('RECTANGLE', pageId(graph), { name: 'Original' })
    const checkpoint = captureTouchedCheckpoint(graph)
    graph.nodes.set(rect.id, { ...structuredClone(rect), name: 'Replacement' })
    graph.updateNode(rect.id, { opacity: 0.5 })
    expect(() => checkpoint.assertPropertiesOnly()).toThrow('must not change node hierarchy')
    checkpoint.restore()
    expect(graph.getNode(rect.id)).toBe(rect)
    expect(rect.name).toBe('Original')
    expect(rect.opacity).toBe(1)
  })

  test('a rollback puts a node removed and set again back in its place', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const first = graph.createNode('RECTANGLE', page)
    graph.createNode('RECTANGLE', page)
    const order = [...graph.nodes.keys()]
    const checkpoint = captureTouchedCheckpoint(graph)
    graph.nodes.delete(first.id)
    graph.nodes.set(first.id, first)
    expect([...graph.nodes.keys()]).not.toEqual(order)
    checkpoint.restore()
    expect([...graph.nodes.keys()]).toEqual(order)
  })

  test('a rollback restores the connector list for created and deleted connectors', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const kept = graph.createNode('CONNECTOR', page)
    const checkpoint = captureTouchedCheckpoint(graph)
    graph.deleteNode(kept.id)
    const added = graph.createNode('CONNECTOR', page)
    expect(graph.connectorIds.has(kept.id)).toBe(false)
    checkpoint.restore()
    expect(graph.getNode(kept.id)).toBe(kept)
    expect(graph.getNode(added.id)).toBeUndefined()
    expect([...graph.connectorIds]).toEqual([kept.id])
  })

  test('a rollback drops absolute positions the edit cached', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), { x: 10 })
    const rect = graph.createNode('RECTANGLE', frame.id, { x: 5 })
    expect(graph.getAbsolutePosition(rect.id).x).toBe(15)
    const checkpoint = captureTouchedCheckpoint(graph)
    graph.updateNode(frame.id, { x: 100 })
    expect(graph.getAbsolutePosition(rect.id).x).toBe(105)
    checkpoint.restore()
    expect(frame.x).toBe(10)
    expect(graph.getAbsolutePosition(rect.id).x).toBe(15)
  })
})
