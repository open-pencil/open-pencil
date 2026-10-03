import { expect, test } from 'bun:test'

import { createInstanceOverrideState, remapInstanceOverrideState } from '@open-pencil/scene-graph'

test('override transfer remaps typed identities without rewriting equal text', () => {
  const state = createInstanceOverrideState()
  state.self.set('componentId', 'source')
  state.self.set('text', 'source')
  state.descendants.set(
    'child',
    new Map<string, unknown>([
      ['sourceComponentId', 'source'],
      ['boundVariables/paddingLeft', 'token'],
      ['boundVariables/paddingRight', undefined],
      ['visible', false],
      ['fills', [{ marker: 'source' }]]
    ])
  )
  const before = structuredClone(state)
  const result = remapInstanceOverrideState(state, {
    node: (id) => `node/${id}`,
    variable: (id) => `variable/${id}`
  })
  expect(result.self.get('componentId')).toBe('node/source')
  expect(result.self.get('text')).toBe('source')
  expect(result.descendants.get('node/child')).toEqual(
    new Map<string, unknown>([
      ['sourceComponentId', 'node/source'],
      ['boundVariables/paddingLeft', 'variable/token'],
      ['boundVariables/paddingRight', undefined],
      ['visible', false],
      ['fills', [{ marker: 'source' }]]
    ])
  )
  expect(state).toEqual(before)
})

test('override transfer rejects colliding target mappings', () => {
  const state = createInstanceOverrideState()
  state.descendants.set('a', new Map())
  state.descendants.set('b', new Map())
  expect(() =>
    remapInstanceOverrideState(state, { node: () => 'same', variable: (id) => id })
  ).toThrow('Duplicate remapped override target')
})
