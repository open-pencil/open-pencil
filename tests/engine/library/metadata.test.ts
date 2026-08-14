import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { deserializeSceneGraph, serializeSceneGraph } from '#core/kiwi/fig/parse/transfer'

describe('library graph metadata', () => {
  test('serializes enabled library bindings and node source identity', () => {
    const graph = new SceneGraph()
    graph.enabledLibraries.set('design-system', {
      libraryId: 'design-system',
      revisionId: 'revision-1',
      enabled: true
    })
    const page = graph.getPages()[0]
    if (!page) throw new Error('Expected page')
    const component = graph.createNode('COMPONENT', page.id, {
      name: 'Button',
      librarySource: {
        identity: {
          libraryId: 'design-system',
          assetKey: 'button',
          revisionId: 'revision-1'
        },
        sourceNodeId: 'source-button',
        readOnly: true
      }
    })

    const restored = deserializeSceneGraph(serializeSceneGraph(graph))
    expect(restored.enabledLibraries.get('design-system')).toEqual({
      libraryId: 'design-system',
      revisionId: 'revision-1',
      enabled: true
    })
    expect(restored.getNode(component.id)?.librarySource).toEqual(component.librarySource)
  })
})
