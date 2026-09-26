import { expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import { materializeComponentClosure } from '#fig/instance-overrides/component-closure'
import { interpretInstance } from '#fig/instance-overrides/interpret'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

function records(defaultId = 2): NodeChange[] {
  return [
    {
      guid: guid(1),
      type: 'SYMBOL',
      name: 'Host',
      componentPropDefs: [
        {
          id: guid(10),
          name: 'Choice',
          type: 'INSTANCE_SWAP',
          initialValue: { guidValue: guid(defaultId) },
          preferredValues: { instanceSwapValues: [{ key: 'external-choice', version: 'v1' }] }
        }
      ]
    },
    { guid: guid(2), type: 'SYMBOL', name: 'Inactive default' },
    { guid: guid(3), type: 'INSTANCE', symbolData: { symbolID: guid(1) } }
  ] as NodeChange[]
}

for (const defaultId of [1, 2]) {
  test(`closure includes and remaps inactive default ${defaultId} without expanding it`, () => {
    const changes = records(defaultId)
    const graph = new SceneGraph()
    const closure = materializeComponentClosure(
      graph,
      graph.getPages()[0].id,
      changes,
      interpretInstance(changes, '1:3')
    )
    const host = closure.get('1:1')?.materialized.root
    const target = closure.get(`1:${defaultId}`)?.materialized.root
    expect(target?.type).toBe('COMPONENT')
    expect(host?.componentPropertyDefinitions[0].defaultValue).toBe(target?.id)
    expect(closure.externalPreferredKeys).toEqual(new Set(['external-choice']))
    expect(host?.componentPropertyDefinitions[0].preferredValues).toEqual(['external-choice'])
    expect(host?.childIds).toEqual([])
    expect(changes[0].componentPropDefs?.[0].initialValue?.guidValue).toEqual(guid(defaultId))
  })
}

test('closure rejects missing required defaults rather than retaining dangling source IDs', () => {
  const changes = records(999)
  const graph = new SceneGraph()
  expect(() =>
    materializeComponentClosure(
      graph,
      graph.getPages()[0].id,
      changes,
      interpretInstance(changes, '1:3')
    )
  ).toThrow()
})

test('closure resolves available preferred choices by exact resource version', () => {
  const changes = records()
  changes.push({ guid: guid(4), type: 'SYMBOL', key: 'external-choice', version: 'v1' })
  changes.push({ guid: guid(5), type: 'SYMBOL', key: 'external-choice', version: 'v2' })
  const graph = new SceneGraph()
  const closure = materializeComponentClosure(
    graph,
    graph.getPages()[0].id,
    changes,
    interpretInstance(changes, '1:3')
  )
  expect(closure.has('1:4')).toBe(true)
  expect(closure.has('1:5')).toBe(false)
  expect(closure.externalPreferredKeys.size).toBe(0)
})
