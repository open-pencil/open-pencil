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
  test('respects explicit instance scope and leaves other assets untouched', async () => {
    const oldSource = source('Old')
    const oldPage = oldSource.getPages()[0]
    oldSource.createNode('COMPONENT', oldPage.id, {
      name: 'Card',
      componentKey: 'card',
      width: 200
    })
    const newSource = source('New')
    const newPage = newSource.getPages()[0]
    newSource.createNode('COMPONENT', newPage.id, {
      name: 'Card',
      componentKey: 'card',
      width: 200
    })
    const first = await createLibraryRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: oldSource
    })
    const second = await createLibraryRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph: newSource,
      previousRevisionId: first.manifest.revisionId
    })
    const consumer = new SceneGraph()
    const button = materializeLibraryAsset(consumer, first, 'button')
    const card = materializeLibraryAsset(consumer, first, 'card')
    const firstPage = consumer.getPages()[0]
    const secondPage = consumer.addPage('Second')
    const reviewed = consumer.createNode('INSTANCE', firstPage.id, {
      componentId: button.componentId
    })
    const samePage = consumer.createNode('INSTANCE', firstPage.id, {
      componentId: button.componentId
    })
    const otherPage = consumer.createNode('INSTANCE', secondPage.id, {
      componentId: button.componentId
    })
    const otherAsset = consumer.createNode('INSTANCE', firstPage.id, {
      componentId: card.componentId
    })
    materializeLibraryAsset(consumer, second, 'button')

    const plans = planOutdatedLibraryInstances(
      consumer,
      second,
      new Set(['button']),
      new Set([reviewed.id])
    )
    expect(plans.map((plan) => plan.instanceId)).toEqual([reviewed.id])
    const plan = plans[0]
    if (!plan) throw new Error('Expected scoped plan')
    consumer.swapInstanceComponent(plan.instanceId, plan.componentId)
    expect(consumer.getNode(reviewed.id)?.componentId).toBe(plan.componentId)
    expect(consumer.getNode(samePage.id)?.componentId).toBe(button.componentId)
    expect(consumer.getNode(otherPage.id)?.componentId).toBe(button.componentId)
    expect(consumer.getNode(otherAsset.id)?.componentId).toBe(card.componentId)
    consumer.swapInstanceComponent(plan.instanceId, plan.previousComponentId)
    expect(consumer.getNode(reviewed.id)?.componentId).toBe(button.componentId)
  })

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
