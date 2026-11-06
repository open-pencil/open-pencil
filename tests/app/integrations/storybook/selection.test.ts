import { expect, test } from 'bun:test'

import {
  implementationSelection,
  type ImplementationSelection
} from '@/app/integrations/storybook/selection'

import { firstPageId, makeSceneGraph } from '#tests/helpers/scene'

test('implementation selection requires exactly one saved component, set, or resolvable instance', () => {
  const graph = makeSceneGraph()
  const page = firstPageId(graph)
  const component = graph.createNode('COMPONENT', page)
  component.source.id = '42:9'
  const set = graph.createNode('COMPONENT_SET', page)
  set.source.id = '42:10'
  const unsaved = graph.createNode('COMPONENT', page)
  const rectangle = graph.createNode('RECTANGLE', page)
  rectangle.source.id = '42:11'
  const instance = graph.createNode('INSTANCE', page, { componentId: component.id })
  const detached = graph.createNode('INSTANCE', page)
  detached.source.id = '42:12'
  const unsavedInstance = graph.createNode('INSTANCE', page, { componentId: unsaved.id })
  const invalidInstance = graph.createNode('INSTANCE', page, { componentId: rectangle.id })
  const ineligible: string[][] = [
    [],
    [component.id, set.id],
    [rectangle.id],
    [unsaved.id],
    [detached.id],
    [unsavedInstance.id],
    [invalidInstance.id]
  ]
  for (const ids of ineligible) {
    expect(implementationSelection({ graph, state: { selectedIds: new Set(ids) } })).toBeUndefined()
  }
  const eligible: ImplementationSelection[] = [
    { node: component, component, sourceId: '42:9' },
    { node: set, component: set, sourceId: '42:10' },
    { node: instance, component, sourceId: '42:9' }
  ]
  for (const expected of eligible) {
    expect(
      implementationSelection({ graph, state: { selectedIds: new Set([expected.node.id]) } })
    ).toEqual(expected)
  }
})
