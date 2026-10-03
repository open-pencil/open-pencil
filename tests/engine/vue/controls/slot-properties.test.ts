import { describe, expect, test } from 'bun:test'

import { SceneGraph, instanceSlotFrames } from '@open-pencil/scene-graph'
import type { ComponentPropertyDefinition } from '@open-pencil/scene-graph'
import { slotInstanceOptions, slotLimits } from '@open-pencil/vue'

function card() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const item = graph.createNode('COMPONENT', pageId, { name: 'Item', componentKey: 'item-key' })
  const other = graph.createNode('COMPONENT', pageId, { name: 'Avatar' })
  const definition: ComponentPropertyDefinition = {
    id: 'card:body',
    name: 'Body',
    type: 'SLOT',
    defaultValue: '',
    preferredValues: ['item-key'],
    slotSettings: { minChildren: 1, maxChildren: 2, allowPreferredValuesOnly: true }
  }
  const component = graph.createNode('COMPONENT', pageId, {
    name: 'Card',
    componentPropertyDefinitions: [definition]
  })
  const body = graph.createNode('FRAME', component.id, {
    name: 'Body',
    componentPropertyReferences: [{ propertyId: definition.id, field: 'SLOT_CONTENT' }]
  })
  graph.createNode('TEXT', body.id, { name: 'Default' })
  return { graph, item, other, definition, component }
}

describe('slot property model', () => {
  test('finds the instance frame that holds a slot', () => {
    const { graph, component } = card()
    const instance = graph.createInstance(component.id, graph.getPages()[0].id)
    if (!instance) throw new Error('No instance')
    expect(instanceSlotFrames(graph, instance).map((frame) => frame.name)).toEqual(['Body'])
  })

  test('measures limits against the content and names offending layers', () => {
    const { graph, item, definition, component } = card()
    const body = graph.getChildren(component.id)[0]
    const preferred = graph.createInstance(item.id, body.id)
    if (!preferred) throw new Error('No instance')
    const content = graph.getChildren(body.id)
    const [text] = content
    expect(slotLimits(graph, definition, content)).toEqual({
      limits: [
        { kind: 'minimum', count: 1, met: true },
        { kind: 'maximum', count: 2, met: true },
        { kind: 'preferred', met: false, offending: 1 }
      ],
      offendingIds: [text.id]
    })
    expect(slotLimits(graph, definition, []).limits[0]).toMatchObject({ met: false })
  })

  test('lists components with preferred ones first', () => {
    const { graph, definition } = card()
    expect(
      slotInstanceOptions(graph, definition).map(({ name, preferred }) => [name, preferred])
    ).toEqual([
      ['Item', true],
      ['Avatar', false],
      ['Card', false]
    ])
  })
})
