import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { collectionModeIds, layerAppliedModeCount } from '@/components/LayerTree/mode-names'

describe('layer applied mode count', () => {
  test('count only modes whose collection and mode still exist', () => {
    const graph = new SceneGraph()
    const theme = graph.createCollection('Theme')
    const dark = graph.createMode(theme.id, 'Dark')
    const density = graph.createCollection('Density')
    const compact = graph.createMode(density.id, 'Compact')
    if (!dark || !compact) {
      throw new Error('Expected second modes')
    }
    const variableModes = { [theme.id]: dark, [density.id]: compact, missing: 'mode' }

    expect(layerAppliedModeCount(variableModes, collectionModeIds(graph))).toBe(2)
    graph.removeMode(density.id, compact)
    expect(layerAppliedModeCount(variableModes, collectionModeIds(graph))).toBe(1)
    graph.removeCollection(theme.id)
    expect(layerAppliedModeCount(variableModes, collectionModeIds(graph))).toBe(0)
    expect(layerAppliedModeCount(undefined, collectionModeIds(graph))).toBe(0)
  })
})
