import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import {
  MIXED,
  compatibleComponentPropertyDefinitions,
  instanceSwapOptions,
  mergedComponentPropertyValue
} from '@open-pencil/vue'

describe('component property control model', () => {
  test('requires identical ordered property IDs and types', () => {
    const definitions = [
      { id: '1:1', name: 'Label', type: 'TEXT' as const, defaultValue: 'Default' },
      { id: '1:2', name: 'Visible', type: 'BOOLEAN' as const, defaultValue: 'true' }
    ]
    expect(
      compatibleComponentPropertyDefinitions([definitions, structuredClone(definitions)])
    ).toBe(definitions)
    expect(
      compatibleComponentPropertyDefinitions([
        definitions,
        [{ ...definitions[0], type: 'BOOLEAN' as const }]
      ])
    ).toEqual([])
  })

  test('models mixed values and preferred instance swap options', () => {
    expect(mergedComponentPropertyValue(['A', 'A'])).toBe('A')
    expect(mergedComponentPropertyValue(['A', 'B'])).toBe(MIXED)

    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const secondary = graph.createNode('COMPONENT', pageId, { name: 'Secondary' })
    const preferred = graph.createNode('COMPONENT', pageId, {
      name: 'Preferred',
      componentKey: 'preferred-key'
    })
    expect(
      instanceSwapOptions(
        [secondary, preferred],
        {
          id: '1:3',
          name: 'Icon',
          type: 'INSTANCE_SWAP',
          defaultValue: secondary.id,
          preferredValues: ['preferred-key']
        },
        'missing-id'
      )
    ).toEqual([
      { value: preferred.id, label: 'Preferred', preferred: true },
      { value: secondary.id, label: 'Secondary', preferred: false },
      { value: 'missing-id', label: 'missing-id', missing: true }
    ])
  })
})
