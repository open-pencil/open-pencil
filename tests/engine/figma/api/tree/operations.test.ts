import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#tests/helpers/assert'

import { createAPI } from '../helpers'

describe('tree operations', () => {
  test('appendChild reparents', () => {
    const api = createAPI()
    const parent = api.createFrame()
    const child = api.createRectangle()
    parent.appendChild(child)
    expect(parent.children.length).toBe(1)
    expect(parent.children[0].id).toBe(child.id)
    expect(expectDefined(child.parent, 'child parent').id).toBe(parent.id)
  })

  test('insertChild at index', () => {
    const api = createAPI()
    const parent = api.createFrame()
    const a = api.createRectangle()
    const b = api.createRectangle()
    const c = api.createRectangle()
    parent.appendChild(a)
    parent.appendChild(b)
    parent.insertChild(1, c)
    expect(parent.children.map((c) => c.id)).toEqual([a.id, c.id, b.id])
  })

  test('remove deletes node', () => {
    const api = createAPI()
    const frame = api.createFrame()
    const id = frame.id
    frame.remove()
    expect(api.getNodeById(id)).toBeNull()
  })

  test('removed property', () => {
    const api = createAPI()
    const frame = api.createFrame()
    expect(frame.removed).toBe(false)
    frame.remove()
    expect(frame.removed).toBe(true)
  })
})
