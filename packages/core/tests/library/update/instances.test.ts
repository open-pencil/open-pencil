import { describe, expect, test } from 'bun:test'

import { libraryIdentityForComponent } from '@open-pencil/core/library'
import { SceneGraph, type LibraryAssetSource } from '@open-pencil/scene-graph'

const source = (assetKey: string): LibraryAssetSource => ({
  identity: { libraryId: 'design-system', assetKey, revisionId: 'first' },
  sourceNodeId: null,
  readOnly: true
})

describe('the library asset of a component', () => {
  test('is the set’s for a variant, keyed or not', () => {
    const graph = new SceneGraph()
    const set = graph.createNode('COMPONENT_SET', graph.getPages()[0].id, {
      librarySource: source('chip')
    })
    const keyed = graph.createNode('COMPONENT', set.id, { librarySource: source('chip-hover') })
    const keyless = graph.createNode('COMPONENT', set.id)

    expect(libraryIdentityForComponent(graph, keyed.id)?.assetKey).toBe('chip')
    expect(libraryIdentityForComponent(graph, keyless.id)?.assetKey).toBe('chip')
  })

  test('is its own for a component inside another', () => {
    const graph = new SceneGraph()
    const card = graph.createNode('COMPONENT', graph.getPages()[0].id, {
      librarySource: source('card')
    })
    const badge = graph.createNode('COMPONENT', card.id, { librarySource: source('badge') })

    expect(libraryIdentityForComponent(graph, badge.id)?.assetKey).toBe('badge')
  })
})
