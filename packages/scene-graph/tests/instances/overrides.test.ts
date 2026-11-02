import { describe, expect, test } from 'bun:test'

import {
  bindingOverrideField,
  overriddenBindingField
} from '@open-pencil/scene-graph/instances/overrides'

describe('binding override fields', () => {
  test('claim one binding of the layer, which they name', () => {
    expect(bindingOverrideField('fills/0/color')).toBe('boundVariables/fills/0/color')
    expect(overriddenBindingField(bindingOverrideField('opacity'))).toBe('opacity')
  })

  test('are not overrides of the layer’s fields, nor of all its bindings', () => {
    for (const field of ['fills', 'opacity', 'boundVariables'])
      expect(overriddenBindingField(field)).toBeNull()
  })
})
