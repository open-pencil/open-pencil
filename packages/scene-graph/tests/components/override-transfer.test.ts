import { expect, test } from 'bun:test'

import {
  createInstanceOverrideState,
  remapInstanceOverrideState,
  variableModeOverrideField
} from '@open-pencil/scene-graph/instances/overrides'

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
    variable: (id) => `variable/${id}`,
    collection: (id) => `collection/${id}`
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
    remapInstanceOverrideState(state, {
      node: () => 'same',
      variable: (id) => id,
      collection: (id) => id
    })
  ).toThrow('Duplicate remapped override target')
})

test('override transfer remaps the collection a mode override is keyed by', () => {
  const state = createInstanceOverrideState()
  state.descendants.set(
    'child',
    new Map<string, unknown>([
      [variableModeOverrideField('sizes'), true],
      [variableModeOverrideField('gone'), true]
    ])
  )
  const result = remapInstanceOverrideState(state, {
    node: (id) => id,
    variable: (id) => id,
    collection: (id) => (id === 'sizes' ? 'pasted-sizes' : undefined)
  })
  expect(result.descendants.get('child')).toEqual(
    new Map<string, unknown>([[variableModeOverrideField('pasted-sizes'), true]])
  )
})

test('override transfer without a collection mapper keeps mode override keys', () => {
  const state = createInstanceOverrideState()
  state.descendants.set(
    'child',
    new Map<string, unknown>([[variableModeOverrideField('sizes'), true]])
  )
  const result = remapInstanceOverrideState(state, { node: (id) => id, variable: (id) => id })
  expect(result.descendants.get('child')).toEqual(
    new Map<string, unknown>([[variableModeOverrideField('sizes'), true]])
  )
})
