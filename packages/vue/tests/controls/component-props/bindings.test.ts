import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { groupComponentBindings } from '#vue/controls/component-props/bindings'

test('groups repeated structural bindings across 23 variants without merging same-named siblings', () => {
  const graph = new SceneGraph()
  const set = graph.createNode('COMPONENT_SET', graph.getPages()[0].id)
  const bindings = Array.from({ length: 23 }, (_, index) => {
    const variant = graph.createNode('COMPONENT', set.id, { name: `Variant ${index}` })
    return [0, 1].map(() => {
      const node = graph.createNode('TEXT', variant.id, { name: 'Label' })
      return { node, name: node.name, nodeId: node.id, field: 'TEXT' as const }
    })
  }).flat()
  const groups = groupComponentBindings(graph, bindings)
  expect(groups).toHaveLength(2)
  expect(groups.map((group) => group.bindings.length)).toEqual([23, 23])
  expect(new Set(groups[0].bindings.map((binding) => binding.variantId)).size).toBe(23)
})
