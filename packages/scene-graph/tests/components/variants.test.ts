import { describe, expect, test } from 'bun:test'

import {
  defaultVariant,
  restingVariant,
  SceneGraph,
  variantDefaultValue
} from '@open-pencil/scene-graph'

/** A set of sizes laid out with Large first in its children but Small in the top-left corner. */
function sizes(defaultValue: string) {
  const graph = new SceneGraph()
  const definition = {
    id: 'size',
    name: 'Size',
    type: 'VARIANT' as const,
    defaultValue,
    variantOptions: ['Small', 'Large']
  }
  const set = graph.createNode('COMPONENT_SET', graph.getPages()[0].id, {
    name: 'Button',
    componentPropertyDefinitions: [definition]
  })
  graph.createNode('COMPONENT', set.id, {
    name: 'Size=Large',
    x: 0,
    y: 60,
    componentPropertyValues: { Size: 'Large' }
  })
  graph.createNode('COMPONENT', set.id, {
    name: 'Size=Small',
    x: 0,
    y: 0,
    componentPropertyValues: { Size: 'Small' }
  })
  return { graph, set, definition }
}

describe('default variants', () => {
  test('are the variant in the top-left corner, whatever the order of the children', () => {
    const { graph, set } = sizes('')
    expect(defaultVariant(graph, set)?.name).toBe('Size=Small')
  })

  test('give a property its default value when the document leaves it out', () => {
    const empty = sizes('')
    expect(variantDefaultValue(empty.graph, empty.set, empty.definition)).toBe('Small')
    // A recorded default that is one of the options stands.
    const recorded = sizes('Large')
    expect(variantDefaultValue(recorded.graph, recorded.set, recorded.definition)).toBe('Large')
  })

  test('rest at the recorded defaults when they name a variant, else at the default variant', () => {
    const recorded = sizes('Large')
    expect(restingVariant(recorded.graph, recorded.set)?.name).toBe('Size=Large')
    const empty = sizes('')
    expect(restingVariant(empty.graph, empty.set)?.name).toBe('Size=Small')
  })
})
