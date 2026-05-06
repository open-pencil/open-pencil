import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#tests/helpers/assert'

import { createAPI } from './helpers'

describe('grouping', () => {
  test('group creates GROUP with children', () => {
    const api = createAPI()
    const a = api.createRectangle()
    const b = api.createEllipse()
    const group = api.group([a, b], api.currentPage)
    expect(group.type).toBe('GROUP')
    expect(group.children.length).toBe(2)
  })

  test('ungroup dissolves group', () => {
    const api = createAPI()
    const a = api.createRectangle()
    const b = api.createEllipse()
    const group = api.group([a, b], api.currentPage)
    const groupId = group.id
    api.ungroup(group)
    expect(api.getNodeById(groupId)).toBeNull()
    expect(expectDefined(a.parent, 'ungrouped parent').id).toBe(api.currentPage.id)
  })
})
