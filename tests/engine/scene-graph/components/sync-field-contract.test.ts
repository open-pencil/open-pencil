import { expect, test } from 'bun:test'

import { SceneGraph, setInstanceOverride } from '@open-pencil/scene-graph'

import { expectDefined } from '#tests/helpers/assert'

for (const protectedField of ['width', 'text'] as const) {
  test(`component synchronization preserves ${protectedField} without freezing other fields`, () => {
    const graph = new SceneGraph()
    const component = graph.createNode('COMPONENT', graph.getPages()[0].id)
    const source = graph.createNode('TEXT', component.id, {
      text: 'Source',
      visible: false,
      width: 80
    })
    const instance = expectDefined(graph.createInstance(component.id, graph.getPages()[0].id))
    const clone = graph.getChildren(instance.id)[0]
    graph.updateNode(clone.id, { text: 'Override', visible: true, width: 160 })
    setInstanceOverride(instance.instanceOverrides, instance.id, clone.id, protectedField, true)
    graph.syncInstances(component.id)
    expect(clone.text).toBe(protectedField === 'text' ? 'Override' : source.text)
    expect(clone.width).toBe(protectedField === 'width' ? 160 : 80)
    expect(clone.visible).toBe(false)
  })
}

test('component synchronization updates and removes opacity bindings while preserving a claimed width binding', () => {
  const graph = new SceneGraph()
  const component = graph.createNode('COMPONENT', graph.getPages()[0].id, {
    opacity: 0.5,
    boundVariables: { opacity: 'opacity-var' }
  })
  const instance = expectDefined(graph.createInstance(component.id, graph.getPages()[0].id))
  expect(instance.opacity).toBe(0.5)
  expect(instance.boundVariables.opacity).toBe('opacity-var')
  graph.updateNode(instance.id, {
    boundVariables: { ...instance.boundVariables, width: 'width-var' }
  })
  setInstanceOverride(
    instance.instanceOverrides,
    instance.id,
    instance.id,
    'boundVariables/width',
    true
  )
  graph.updateNode(component.id, { opacity: 1, boundVariables: {} })
  graph.syncInstances(component.id)
  expect(instance.boundVariables).toEqual({ width: 'width-var' })
  expect(instance.opacity).toBe(1)
})
