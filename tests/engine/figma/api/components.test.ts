import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#tests/helpers/assert'

import { createAPI } from './helpers'

describe('components', () => {
  test('createInstance from component', () => {
    const api = createAPI()
    const comp = api.createComponent()
    comp.name = 'Button'
    comp.resize(200, 40)
    const instance = comp.createInstance()
    expect(instance.type).toBe('INSTANCE')
    expect(expectDefined(instance.mainComponent, 'instance main component').id).toBe(comp.id)
  })
})
