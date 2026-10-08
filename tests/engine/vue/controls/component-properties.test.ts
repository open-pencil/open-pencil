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
        graph,
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

  test('leaves out swaps that would contain themselves and names variants with their set', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const star = graph.createNode('COMPONENT', pageId, { name: 'Star' })
    const button = graph.createNode('COMPONENT', pageId, { name: 'Button' })
    const icon = graph.createInstance(star.id, button.id, { name: 'Icon' })
    const card = graph.createNode('COMPONENT', pageId, { name: 'Card' })
    const action = graph.createInstance(button.id, card.id, { name: 'Action' })
    const badge = graph.createNode('COMPONENT_SET', pageId, { name: 'Badge' })
    const info = graph.createNode('COMPONENT', badge.id, { name: 'State=Info' })
    if (!icon || !action) throw new Error('Expected instances')
    const definition = {
      id: '1:4',
      name: 'Icon',
      type: 'INSTANCE_SWAP' as const,
      defaultValue: star.id
    }
    const components = [...graph.getAllNodes()]

    // The icon inside Button, as Card's Action shows it: neither Button nor Card can replace it.
    const options = instanceSwapOptions(graph, components, definition, star.id, [action.id])
    expect(options.map((option) => option.label)).toEqual(['Badge / State=Info', 'Star'])
    expect(options.map((option) => option.value)).toEqual([info.id, star.id])
  })
})
