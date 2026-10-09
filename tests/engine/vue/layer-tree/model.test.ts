import { describe, expect, test } from 'bun:test'

import {
  buildLayerTreeModel,
  layerSelectionForTarget,
  patchLayerNode,
  visibleLayerRows
} from '@open-pencil/vue'

import { createRect, firstPageId, makeSceneGraph } from '#tests/helpers/scene'

describe('layer tree model', () => {
  test('builds indexed nested items in scene order', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const frame = graph.createNode('FRAME', pageId, { name: 'Frame' })
    const child = createRect(graph, frame.id, { name: 'Child' })
    const sibling = createRect(graph, pageId, { name: 'Sibling' })
    const internal = graph.createNode('RECTANGLE', pageId, {
      name: 'Internal style',
      internalOnly: true
    })

    const model = buildLayerTreeModel(graph, pageId)

    expect(model.items.map((node) => node.id)).toEqual([frame.id, sibling.id])
    expect(model.items[0]?.children?.map((node) => node.id)).toEqual([child.id])
    expect(model.byId.get(child.id)?.name).toBe('Child')
    expect(model.byId.has(internal.id)).toBe(false)
  })

  test('derives only rows made visible by expansion', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const frame = graph.createNode('FRAME', pageId, { name: 'Frame' })
    const nested = graph.createNode('FRAME', frame.id, { name: 'Nested' })
    const child = createRect(graph, nested.id, { name: 'Child' })
    const model = buildLayerTreeModel(graph, pageId)

    expect(visibleLayerRows(model.items, new Set()).map((row) => row.node.id)).toEqual([frame.id])
    expect(
      visibleLayerRows(model.items, new Set([frame.id, nested.id])).map((row) => [
        row.node.id,
        row.level
      ])
    ).toEqual([
      [frame.id, 1],
      [nested.id, 2],
      [child.id, 3]
    ])
  })

  test('patches an indexed node without replacing its identity', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const sceneNode = createRect(graph, pageId, { name: 'Before' })
    const model = buildLayerTreeModel(graph, pageId)
    const layerNode = model.byId.get(sceneNode.id)
    expect(layerNode).toBeDefined()
    if (!layerNode) return

    graph.updateNode(sceneNode.id, { name: 'After', visible: false })
    const updated = graph.getNode(sceneNode.id)
    expect(updated).toBeDefined()
    if (!updated) return

    expect(patchLayerNode(layerNode, updated)).toBe(true)
    expect(model.items[0]).toBe(layerNode)
    expect(layerNode).toMatchObject({ name: 'After', visible: false })
    expect(patchLayerNode(layerNode, updated)).toBe(false)
  })
})

describe('layer tree selection', () => {
  const rows = ['a', 'b', 'c', 'd']

  test('replaces, toggles, and ranges from the anchor', () => {
    expect(
      layerSelectionForTarget(rows, new Set(['a']), 'a', 'c', {
        additive: false,
        range: true
      })
    ).toEqual(new Set(['a', 'b', 'c']))
    expect(
      layerSelectionForTarget(rows, new Set(['a']), 'a', 'c', {
        additive: true,
        range: true
      })
    ).toEqual(new Set(['a', 'b', 'c']))
    expect(
      layerSelectionForTarget(rows, new Set(['a', 'b']), 'a', 'b', {
        additive: true,
        range: false
      })
    ).toEqual(new Set(['a']))
  })

  test('falls back to the target when the anchor is not visible', () => {
    expect(
      layerSelectionForTarget(rows, new Set(['a']), 'missing', 'd', {
        additive: true,
        range: true
      })
    ).toEqual(new Set(['d']))
  })
})
