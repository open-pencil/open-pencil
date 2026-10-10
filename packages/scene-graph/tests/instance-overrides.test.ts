import { describe, expect, test } from 'bun:test'

import {
  clearInstanceOverrides,
  cloneInstanceOverrideState,
  createInstanceOverrideState,
  deleteInstanceOverride,
  deserializeInstanceOverrideState,
  forEachInstanceOverride,
  getInstanceOverride,
  hasInstanceOverride,
  remapInstanceOverrideState,
  serializeInstanceOverrideState,
  setInstanceOverride
} from '../src/instance-overrides'

describe('instance override state', () => {
  test('stores the instance’s own fields and those of layers by path', () => {
    const state = createInstanceOverrideState()
    setInstanceOverride(state, [], 'visible', false)
    setInstanceOverride(state, ['1:2', '1:5'], 'text', 'Custom')
    expect(getInstanceOverride(state, [], 'visible')).toBe(false)
    expect(getInstanceOverride(state, ['1:2', '1:5'], 'text')).toBe('Custom')
    expect(hasInstanceOverride(state, ['1:2'], 'text')).toBe(false)
    expect([...state.layers.keys()]).toEqual(['1:2;1:5'])
  })

  test('reports presence for an explicit undefined override', () => {
    const state = createInstanceOverrideState()
    state.layers.set('1:2', new Map([['visible', undefined]]))
    expect(hasInstanceOverride(state, ['1:2'], 'visible')).toBe(true)
  })

  test('round-trips explicit undefined values through JSON', () => {
    const state = createInstanceOverrideState()
    state.self.set('opacity', undefined)
    state.layers.set('1:2', new Map([['visible', undefined]]))
    // eslint-disable-next-line unicorn/prefer-structured-clone -- exercise the JSON boundary
    const serialized: unknown = JSON.parse(JSON.stringify(serializeInstanceOverrideState(state)))
    const restored = deserializeInstanceOverrideState(serialized)

    expect(hasInstanceOverride(restored, [], 'opacity')).toBe(true)
    expect(getInstanceOverride(restored, [], 'opacity')).toBeUndefined()
    expect(hasInstanceOverride(restored, ['1:2'], 'visible')).toBe(true)
    expect(getInstanceOverride(restored, ['1:2'], 'visible')).toBeUndefined()
  })

  test('ignores malformed serialized entries', () => {
    const state = deserializeInstanceOverrideState({ self: [null], layers: [[1, []]] })
    expect(state.self.size).toBe(0)
    expect(state.layers.size).toBe(0)
  })

  test('deletes empty layer buckets', () => {
    const state = createInstanceOverrideState()
    setInstanceOverride(state, ['1:2'], 'text', 'Custom')
    expect(deleteInstanceOverride(state, ['1:2'], 'text')).toBe(true)
    expect(state.layers.size).toBe(0)
  })

  test('clones independently and clears', () => {
    const state = createInstanceOverrideState()
    setInstanceOverride(state, ['1:2'], 'text', 'Custom')
    const clone = cloneInstanceOverrideState(state)
    setInstanceOverride(clone, ['1:2'], 'text', 'Other')
    expect(getInstanceOverride(state, ['1:2'], 'text')).toBe('Custom')
    clearInstanceOverrides(state)
    expect(state.layers.size).toBe(0)
  })

  test('visits every override with its path', () => {
    const state = createInstanceOverrideState()
    setInstanceOverride(state, [], 'opacity', 0.5)
    setInstanceOverride(state, ['1:2', '1:5'], 'fills', [])
    const visited: unknown[] = []
    forEachInstanceOverride(state, (path, field, value) => visited.push([path, field, value]))
    expect(visited).toEqual([
      [[], 'opacity', 0.5],
      [['1:2', '1:5'], 'fills', []]
    ])
  })

  test('remaps the component layers paths name, swapped components, and variables', () => {
    const state = createInstanceOverrideState()
    setInstanceOverride(state, ['1:2', '1:5'], 'componentId', '1:9')
    setInstanceOverride(state, ['1:2'], 'boundVariables/opacity', 'var')
    setInstanceOverride(state, ['1:2'], 'name', '1:2')
    const remapped = remapInstanceOverrideState(state, {
      node: (id) => `new-${id}`,
      variable: (id) => `new-${id}`
    })
    expect(getInstanceOverride(remapped, ['new-1:2', 'new-1:5'], 'componentId')).toBe('new-1:9')
    expect(getInstanceOverride(remapped, ['new-1:2'], 'boundVariables/opacity')).toBe('new-var')
    expect(getInstanceOverride(remapped, ['new-1:2'], 'name')).toBe('1:2')
  })
})
