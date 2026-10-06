import { expect, test } from 'bun:test'

import { renderTree } from '@open-pencil/core/design-jsx'
import { Component, ComponentSet, Frame, Text } from '@open-pencil/design-jsx'
import type { ComponentPropertyDefinition } from '@open-pencil/scene-graph'

import { makeSceneGraph } from '#tests/helpers/scene'

const definitions: ComponentPropertyDefinition[] = [
  { id: 'caption', name: 'Caption', type: 'TEXT', defaultValue: 'Hello' },
  { id: 'visible', name: 'Visible', type: 'BOOLEAN', defaultValue: 'true' }
]

for (const reference of [
  { propertyId: 'missing', field: 'TEXT' },
  { propertyId: 'visible', field: 'TEXT' },
  { propertyId: 'caption', field: 'VISIBLE' }
] as const) {
  test(`rejects invalid scoped reference ${reference.propertyId}/${reference.field}`, async () => {
    await expect(
      renderTree(
        makeSceneGraph(),
        Component({
          properties: definitions,
          children: Frame({ children: Text({ children: 'Hello', propertyRefs: [reference] }) })
        })
      )
    ).rejects.toThrow(/component property/i)
  })
}

test('accepts references inherited from the owning component set', async () => {
  const result = await renderTree(
    makeSceneGraph(),
    ComponentSet({
      properties: definitions,
      children: Component({
        name: 'Kind=Default',
        children: Frame({
          children: Text({
            children: 'Hello',
            propertyRefs: [{ propertyId: 'caption', field: 'TEXT' }]
          })
        })
      })
    })
  )
  expect(result.type).toBe('COMPONENT_SET')
})

test('does not resolve a nested component reference against the outer component', async () => {
  await expect(
    renderTree(
      makeSceneGraph(),
      Component({
        properties: definitions,
        children: Component({
          children: Text({
            children: 'Hello',
            propertyRefs: [{ propertyId: 'caption', field: 'TEXT' }]
          })
        })
      })
    )
  ).rejects.toThrow('Unknown component property reference: caption')
})
