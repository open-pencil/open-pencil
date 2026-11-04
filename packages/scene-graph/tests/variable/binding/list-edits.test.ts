import { describe, expect, test } from 'bun:test'

import { listBindingsAfterEdit } from '@open-pencil/scene-graph/variables'

const BOUND = {
  'fills/0/color': 'red',
  'fills/2/color': 'blue',
  'effects/0/radius': 'blur',
  'effects/1/color': 'shade',
  width: 'size'
}

describe('list bindings after an edit', () => {
  test('move with their fill when a fill above them is removed', () => {
    expect(listBindingsAfterEdit(BOUND, 'fills', [0, 2])).toEqual({
      'fills/0/color': 'red',
      'fills/1/color': 'blue',
      'effects/0/radius': 'blur',
      'effects/1/color': 'shade',
      width: 'size'
    })
  })

  test('go with the item removed', () => {
    expect(listBindingsAfterEdit(BOUND, 'fills', [1, 2])).toEqual({
      'fills/1/color': 'blue',
      'effects/0/radius': 'blur',
      'effects/1/color': 'shade',
      width: 'size'
    })
  })

  test('follow every property of an effect that moves', () => {
    expect(listBindingsAfterEdit(BOUND, 'effects', [1, 0])).toEqual({
      'fills/0/color': 'red',
      'fills/2/color': 'blue',
      'effects/0/color': 'shade',
      'effects/1/radius': 'blur',
      width: 'size'
    })
  })

  test('stay put when an item is added after them, and go when the list is replaced', () => {
    expect(listBindingsAfterEdit(BOUND, 'fills', [0, 1, 2, null])).toEqual(BOUND)
    expect(listBindingsAfterEdit(BOUND, 'effects', [null])).toEqual({
      'fills/0/color': 'red',
      'fills/2/color': 'blue',
      width: 'size'
    })
  })
})
