import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

/** A set with two variants and an instance of the first, left with the variant's name. */
function setWithInstance() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const set = graph.createNode('COMPONENT_SET', pageId, { name: 'Switch' })
  const off = graph.createNode('COMPONENT', set.id, { name: 'State=Off' })
  const on = graph.createNode('COMPONENT', set.id, { name: 'State=On' })
  const instance = graph.createInstance(off.id, pageId)
  if (!instance) throw new Error('No instance')
  return { graph, instance, on }
}

describe('swapping an instance', () => {
  test("renames an instance named after its component, as Figma does", () => {
    const { graph, instance, on } = setWithInstance()
    graph.swapInstanceComponent(instance.id, on.id)
    expect(graph.getNode(instance.id)?.name).toBe('State=On')
  })

  test('keeps the name when asked, so a view showing another variant keeps layer paths', () => {
    const { graph, instance, on } = setWithInstance()
    graph.swapInstanceComponent(instance.id, on.id, { keepName: true })
    expect(graph.getNode(instance.id)?.name).toBe('State=Off')
    expect(graph.getNode(instance.id)?.componentId).toBe(on.id)
  })
})
