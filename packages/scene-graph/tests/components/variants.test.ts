import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import {
  defaultVariant,
  variantDefaultValue,
  variantOptions
} from '@open-pencil/scene-graph/components'

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

  test('read the set as Figma does: across a row first, then down', () => {
    const at = (x: number, y: number, size = 50) => ({ x, y, width: size, height: size })
    const pick = (...places: Array<ReturnType<typeof at>>) => {
      const graph = new SceneGraph()
      const set = graph.createNode('COMPONENT_SET', graph.getPages()[0].id, { name: 'Set' })
      for (const [index, place] of places.entries())
        graph.createNode('COMPONENT', set.id, { name: `v=${index}`, ...place })
      return defaultVariant(graph, set)?.name
    }
    // Rows apart: the higher one, however far right it is.
    expect(pick(at(100, 0), at(0, 100))).toBe('v=0')
    expect(pick(at(0, 60), at(30, 0))).toBe('v=1')
    // Rows overlapping, or touching, read left to right.
    expect(pick(at(10, 0), at(0, 10))).toBe('v=1')
    expect(pick(at(0, 40), at(30, 0))).toBe('v=0')
    expect(pick(at(200, 0, 100), at(0, 100, 100), at(100, 0, 100))).toBe('v=1')
    // At the same place, the first in layer order.
    expect(pick(at(0, 0), at(0, 0))).toBe('v=0')
  })

  // Figma (desktop 126) reports the default variant's value whatever default the file records,
  // and follows the variant moved to the top left.
  test('give a property the default variant’s value, whatever the document records', () => {
    const empty = sizes('')
    expect(variantDefaultValue(empty.graph, empty.set, empty.definition)).toBe('Small')
    const recorded = sizes('Large')
    expect(variantDefaultValue(recorded.graph, recorded.set, recorded.definition)).toBe('Small')
    const [large, small] = recorded.graph.getChildren(recorded.set.id)
    recorded.graph.updateNode(large.id, { y: 0 })
    recorded.graph.updateNode(small.id, { y: 60 })
    expect(variantDefaultValue(recorded.graph, recorded.set, recorded.definition)).toBe('Large')
  })

  test('keep the recorded default while the default variant has no value for the property', () => {
    const { graph, set, definition } = sizes('Large')
    const small = graph.getChildren(set.id).find((variant) => variant.name === 'Size=Small')
    graph.updateNode(small?.id ?? '', { componentPropertyValues: { Size: '' } })
    expect(variantDefaultValue(graph, set, definition)).toBe('Large')
  })
})

describe('variant options', () => {
  test('keep the recorded values first and add those the variants use', () => {
    const { graph, set } = sizes('')
    const options = variantOptions(graph, set, { name: 'Size', variantOptions: ['Medium'] })
    expect(options).toEqual(['Medium', 'Large', 'Small'])
  })
})
