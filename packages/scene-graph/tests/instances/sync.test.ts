import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import {
  copiedComponentLayerId,
  setInstanceOverride
} from '@open-pencil/scene-graph/instances/overrides'

/**
 * An instance whose copy of the component's label has the link a file records, with the label
 * then replaced by a namesake showing `text`, before the instances sync.
 */
function replacedLabel(text: string) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const component = graph.createNode('COMPONENT', page, { name: 'Button' })
  const old = graph.createNode('TEXT', component.id, { name: 'Label', text: 'Old' })
  const instance = graph.createInstance(component.id, page)
  const copy = instance ? graph.getChildren(instance.id)[0] : undefined
  if (!instance || !copy) throw new Error('Expected the instance and its copy')
  setInstanceOverride(instance.instanceOverrides, instance.id, copy.id, 'sourceComponentId', old.id)
  const label = graph.createNode('TEXT', component.id, { name: 'Label', text })
  graph.deleteNode(old.id)
  return { graph, component, instance, copy, label }
}

describe('instance sync', () => {
  test('links a copy to the namesake that replaces its layer, over the link a file recorded', () => {
    const { graph, component, instance, label } = replacedLabel('New')

    graph.syncInstances(component.id)

    const [synced] = graph.getChildren(instance.id)
    expect(synced?.text).toBe('New')
    expect(copiedComponentLayerId(instance.instanceOverrides, instance.id, synced)).toBe(label.id)
  })

  test('announces the copy and the instance it relinks, as collaboration follows updates', () => {
    // The namesake looks the same, so only the link changes.
    const { graph, component, instance, copy } = replacedLabel('Old')
    const updated = new Set<string>()
    graph.onNodeEvents({ updated: (id) => updated.add(id) })

    graph.syncInstances(component.id)

    expect(updated).toContain(copy.id)
    expect(updated).toContain(instance.id)
  })
})
