import { describe, expect, test } from 'bun:test'

import { ensureLibraryAssetKeys, isValidLibraryAssetKey } from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'

describe('asset keys a library gives from component names', () => {
  test('are valid however the component is named, and distinct among namesakes', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    for (const name of ['.icon', '--', '★', 'x'.repeat(300), 'Button', 'Button'])
      graph.createNode('COMPONENT', page.id, { name })

    const keys = ensureLibraryAssetKeys(graph).map((assignment) => assignment.assetKey)

    expect(keys.every(isValidLibraryAssetKey)).toBe(true)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.slice(0, 3)).toEqual(['icon', 'component', 'component-2'])
  })

  test('keeps the identity a component already publishes under', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const figma = graph.createNode('COMPONENT', page.id, { name: 'Chip', sourceLibraryKey: 'chip' })
    const named = graph.createNode('COMPONENT', page.id, { name: 'Chip' })

    const assignments = ensureLibraryAssetKeys(graph)

    expect(assignments).toEqual([
      { nodeId: figma.id, assetKey: 'chip', existing: true },
      { nodeId: named.id, assetKey: 'chip-2', existing: false }
    ])
    expect(graph.getNode(figma.id)?.componentKey).toBeNull()
  })
})
