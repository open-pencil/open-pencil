import { expect, test } from 'bun:test'

import { renderTree } from '@open-pencil/core/design-jsx'
import { Component, ComponentSet, Instance, Text } from '@open-pencil/design-jsx'
import type { ComponentPropertyDefinition } from '@open-pencil/scene-graph'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { makeSceneGraph } from '#tests/helpers/scene'

const MESSAGE: ComponentPropertyDefinition = {
  id: 'message',
  name: 'Message',
  type: 'TEXT',
  defaultValue: 'Default'
}
const VARIANT: ComponentPropertyDefinition = {
  id: 'variant',
  name: 'variant',
  type: 'VARIANT',
  defaultValue: 'Primary',
  variantOptions: ['Primary', 'Secondary']
}

for (const explicitVariant of [false, true]) {
  test(`component-set properties preserve ${explicitVariant ? 'explicit' : 'inferred'} variant selection`, async () => {
    const graph = makeSceneGraph()
    const set = await renderTree(
      graph,
      ComponentSet({
        properties: explicitVariant ? [MESSAGE, VARIANT] : [MESSAGE],
        children: ['Primary', 'Secondary'].map((variant) =>
          Component({
            name: `variant=${variant}`,
            children: Text({
              children: 'Default',
              propertyRefs: [{ propertyId: MESSAGE.id, field: 'TEXT' }]
            })
          })
        )
      })
    )
    const result = await renderTree(
      graph,
      Instance({ of: set.id, variant: 'Secondary', properties: { message: 'Changed' } })
    )
    const instance = getNodeOrThrow(graph, result.id)
    expect(instance.componentId).toBe(graph.getChildren(set.id)[1].id)
    expect(graph.getChildren(instance.id)[0].text).toBe('Changed')
    const definitions = getNodeOrThrow(graph, set.id).componentPropertyDefinitions
    expect(definitions).toContainEqual(MESSAGE)
    expect(definitions.filter((definition) => definition.type === 'VARIANT')).toHaveLength(1)
    if (explicitVariant) expect(definitions).toContainEqual(VARIANT)
  })
}
