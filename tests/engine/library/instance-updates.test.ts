import { describe, expect, test } from 'bun:test'

import {
  createLibraryRevision,
  materializeLibraryAsset,
  planOutdatedLibraryInstances
} from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'

function source(label: string) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const component = graph.createNode('COMPONENT', page.id, {
    name: 'Button',
    componentKey: 'button',
    width: label === 'New' ? 120 : 80
  })
  graph.createNode('TEXT', component.id, { name: 'Label', text: label })
  return graph
}

describe('instance-authoritative library updates', () => {
  test('plans only outdated instances and permits mixed revisions', async () => {
    const first = await createLibraryRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: source('Old'),
      publishedAt: '2026-01-01T00:00:00.000Z'
    })
    const second = await createLibraryRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: source('New'),
      previousRevisionId: first.manifest.revisionId,
      publishedAt: '2026-01-02T00:00:00.000Z'
    })
    const consumer = new SceneGraph()
    const oldDefinition = materializeLibraryAsset(consumer, first, 'button')
    const firstInstance = consumer.createNode('INSTANCE', consumer.getPages()[0].id, {
      componentId: oldDefinition.componentId
    })
    const secondInstance = consumer.createNode('INSTANCE', consumer.getPages()[0].id, {
      componentId: oldDefinition.componentId
    })
    materializeLibraryAsset(consumer, second, 'button')

    const [firstPlan, secondPlan] = planOutdatedLibraryInstances(consumer, second)
    expect([firstPlan?.instanceId, secondPlan?.instanceId]).toEqual([
      firstInstance.id,
      secondInstance.id
    ])
    expect(firstPlan?.previousComponentId).toBe(oldDefinition.componentId)
    expect(firstPlan?.componentId).not.toBe(oldDefinition.componentId)

    consumer.swapInstanceComponent(firstPlan.instanceId, firstPlan.componentId)
    expect(planOutdatedLibraryInstances(consumer, second).map((plan) => plan.instanceId)).toEqual([
      secondInstance.id
    ])
    expect(consumer.getNode(firstInstance.id)?.componentId).not.toBe(
      consumer.getNode(secondInstance.id)?.componentId
    )
  })
})
