import { expect, test } from 'bun:test'

import { SceneGraph, setInstanceOverride } from '@open-pencil/scene-graph'

import { expectDefined } from '#tests/helpers/assert'

for (const legacyOwner of ['outer', 'self'] as const) {
  test(`per-field claims do not weaken another owner's ${legacyOwner} whole-map protection`, () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const component = graph.createNode('COMPONENT', page, {
      boundVariables: { paddingLeft: 'source-left', paddingRight: 'source-right' },
      variableBindingScales: { paddingLeft: 1, paddingRight: 1 },
      paddingLeft: 20,
      paddingRight: 30
    })
    const outer = graph.createNode('INSTANCE', page)
    const instance = expectDefined(graph.createInstance(component.id, outer.id))
    graph.updateNode(instance.id, {
      boundVariables: { paddingLeft: 'local-left', paddingRight: 'local-right' },
      variableBindingScales: { paddingLeft: 0.5, paddingRight: 0.25 },
      paddingLeft: 10,
      paddingRight: 7.5
    })
    const whole = legacyOwner === 'outer' ? outer : instance
    const granular = legacyOwner === 'outer' ? instance : outer
    setInstanceOverride(whole.instanceOverrides, whole.id, instance.id, 'boundVariables', true)
    setInstanceOverride(
      granular.instanceOverrides,
      granular.id,
      instance.id,
      'boundVariables',
      true
    )
    setInstanceOverride(
      granular.instanceOverrides,
      granular.id,
      instance.id,
      'boundVariables/paddingLeft',
      true
    )
    graph.syncInstances(component.id)
    expect(instance.boundVariables).toEqual({
      paddingLeft: 'local-left',
      paddingRight: 'local-right'
    })
    expect(instance.variableBindingScales).toEqual({ paddingLeft: 0.5, paddingRight: 0.25 })
    expect([instance.paddingLeft, instance.paddingRight]).toEqual([10, 7.5])
  })
}
