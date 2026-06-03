import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@inkly/core'

import { syncChildrenDeep } from '#core/kiwi/fig/instance-overrides/sync/clones'

describe('instance override clone sync', () => {
  test('reclones nested instance children when the source component changes', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const sourceParent = graph.createNode('FRAME', page.id)
    const targetParent = graph.createNode('FRAME', page.id)
    const sourceComponent = graph.createNode('COMPONENT', page.id, { name: 'source component' })
    const targetComponent = graph.createNode('COMPONENT', page.id, { name: 'target component' })
    graph.createNode('TEXT', sourceComponent.id, { name: 'label', text: 'Source' })
    graph.createNode('TEXT', targetComponent.id, { name: 'label', text: 'Target' })
    const sourceChild = graph.createNode('INSTANCE', sourceParent.id, {
      name: 'nested',
      componentId: sourceComponent.id
    })
    graph.populateInstanceChildren(sourceChild.id, sourceComponent.id)
    const targetChild = graph.createNode('INSTANCE', targetParent.id, {
      name: 'nested',
      componentId: targetComponent.id
    })
    graph.populateInstanceChildren(targetChild.id, targetComponent.id)

    syncChildrenDeep(graph, sourceParent.id, targetParent.id, new Set())

    const syncedChild = graph.getNode(targetChild.id)
    expect(syncedChild?.componentId).toBe(sourceComponent.id)
    expect(graph.getChildren(targetChild.id).map((child) => child.text)).toEqual(['Source'])
  })
})
