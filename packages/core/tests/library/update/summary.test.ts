import { describe, expect, test } from 'bun:test'

import {
  createLibraryRevision,
  libraryUpdateImpact,
  materializeLibraryAsset,
  planLibraryInstanceUpdates,
  summarizeLibraryUpdate
} from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'

function revisionGraph(label: string, includeLarge = true) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  if (!page) throw new Error('Expected page')
  const set = graph.createNode('COMPONENT_SET', page.id, {
    name: 'Button',
    componentKey: 'button-set',
    componentPropertyDefinitions: [
      {
        id: 'size',
        name: 'Size',
        type: 'VARIANT',
        defaultValue: 'Small',
        variantOptions: includeLarge ? ['Small', 'Large'] : ['Small']
      }
    ]
  })
  const small = graph.createNode('COMPONENT', set.id, {
    name: 'Size=Small',
    componentKey: 'button-small',
    componentPropertyValues: { Size: 'Small' }
  })
  graph.createNode('TEXT', small.id, { name: 'Label', text: label })
  if (includeLarge) {
    const large = graph.createNode('COMPONENT', set.id, {
      name: 'Size=Large',
      componentKey: 'button-large',
      componentPropertyValues: { Size: 'Large' }
    })
    graph.createNode('TEXT', large.id, { name: 'Label', text: label })
  }
  return graph
}

describe('library updates', () => {
  test('summarizes newer revisions and plans exact variant updates', async () => {
    const first = await createLibraryRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: revisionGraph('Old'),
      publishedAt: '2026-01-01T00:00:00.000Z'
    })
    const next = await createLibraryRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: revisionGraph('New'),
      previousRevisionId: first.manifest.revisionId,
      publishedAt: '2026-01-02T00:00:00.000Z'
    })
    expect(summarizeLibraryUpdate(first, next)).toMatchObject({
      currentRevisionId: first.manifest.revisionId,
      latestRevisionId: next.manifest.revisionId,
      changes: [{ kind: 'modified' }]
    })

    const consumer = new SceneGraph()
    const oldAsset = materializeLibraryAsset(consumer, first, 'button-set')
    const oldSet = consumer.getNode(oldAsset.componentSetId ?? '')
    const oldLarge = oldSet?.childIds
      .map((id) => consumer.getNode(id))
      .find((node) => node?.componentPropertyValues.Size === 'Large')
    if (!oldLarge) throw new Error('Expected old large variant')
    const instance = consumer.createInstance(oldLarge.id, consumer.getPages()[0]?.id ?? '')
    if (!instance) throw new Error('Expected instance')
    materializeLibraryAsset(consumer, next, 'button-set')

    const plans = planLibraryInstanceUpdates(
      consumer,
      'design-system',
      first.manifest.revisionId,
      next.manifest.revisionId,
      next.manifest.assets
    )
    expect(plans).toHaveLength(1)
    expect(consumer.getNode(plans[0]?.componentId ?? '')?.componentPropertyValues).toEqual({
      Size: 'Large'
    })
    expect(plans[0]?.fallback).toBe(false)
    expect(libraryUpdateImpact(plans)).toEqual({
      affectedInstanceCount: 1,
      fallbackInstanceCount: 0
    })
  })

  test('falls back to the new top-left variant when a combination was removed', async () => {
    const first = await createLibraryRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: revisionGraph('Old')
    })
    const next = await createLibraryRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: revisionGraph('New', false),
      previousRevisionId: first.manifest.revisionId
    })
    const consumer = new SceneGraph()
    const oldAsset = materializeLibraryAsset(consumer, first, 'button-set')
    const oldSet = consumer.getNode(oldAsset.componentSetId ?? '')
    const oldLarge = oldSet?.childIds
      .map((id) => consumer.getNode(id))
      .find((node) => node?.componentPropertyValues.Size === 'Large')
    if (!oldLarge) throw new Error('Expected old large variant')
    consumer.createInstance(oldLarge.id, consumer.getPages()[0]?.id ?? '')
    materializeLibraryAsset(consumer, next, 'button-set')

    const plans = planLibraryInstanceUpdates(
      consumer,
      'design-system',
      first.manifest.revisionId,
      next.manifest.revisionId,
      next.manifest.assets
    )
    expect(plans).toHaveLength(1)
    expect(plans[0]?.fallback).toBe(true)
    expect(libraryUpdateImpact(plans)).toEqual({
      affectedInstanceCount: 1,
      fallbackInstanceCount: 1
    })
    expect(consumer.getNode(plans[0]?.componentId ?? '')?.componentPropertyValues).toEqual({
      Size: 'Small'
    })
  })
})
