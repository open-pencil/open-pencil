import { describe, expect, test } from 'bun:test'

import {
  createLibraryRevision,
  createLibraryUpdatePreview,
  materializeLibraryAsset
} from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'

function source(label: string) {
  const graph = new SceneGraph()
  const set = graph.createNode('COMPONENT_SET', graph.getPages()[0].id, {
    name: 'Button',
    componentKey: 'button'
  })
  const component = graph.createNode('COMPONENT', set.id, {
    name: 'Size=Small',
    componentPropertyValues: { Size: 'Small' }
  })
  graph.createNode('TEXT', component.id, { name: 'Label', text: label })
  return graph
}

describe('library update preview', () => {
  test('builds an isolated exact-variant comparison without mutating the consumer', async () => {
    const first = await createLibraryRevision({
      libraryId: 'library',
      name: 'Library',
      graph: source('Old')
    })
    const latest = await createLibraryRevision({
      libraryId: 'library',
      name: 'Library',
      graph: source('New'),
      previousRevisionId: first.manifest.revisionId
    })
    const consumer = new SceneGraph()
    const definition = materializeLibraryAsset(consumer, first, 'button')
    const instance = consumer.createNode('INSTANCE', consumer.getPages()[0].id, {
      componentId: definition.componentId
    })
    const beforeNodes = [...consumer.nodes]
    const beforeBindings = [...consumer.enabledLibraries]

    const preview = createLibraryUpdatePreview(consumer, instance.id, latest)

    expect(preview.fallback).toBe(false)
    expect(preview.graph.getNode(preview.currentNodeId)?.componentPropertyValues).toEqual({
      Size: 'Small'
    })
    expect(preview.graph.getNode(preview.updatedNodeId)?.componentPropertyValues).toEqual({
      Size: 'Small'
    })
    expect([...consumer.nodes]).toEqual(beforeNodes)
    expect([...consumer.enabledLibraries]).toEqual(beforeBindings)
  })
})
