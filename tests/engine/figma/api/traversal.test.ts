import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#tests/helpers/assert'

import { createAPI } from './helpers'

describe('traversal', () => {
  test('findAll finds deep descendants', () => {
    const api = createAPI()
    const parent = api.createFrame()
    parent.name = 'Container'
    const child = api.createFrame()
    child.name = 'Card'
    parent.appendChild(child)
    const text = api.createText()
    text.characters = 'Title'
    text.name = 'Title'
    child.appendChild(text)

    const found = parent.findAll((n) => n.type === 'TEXT')
    expect(found.length).toBe(1)
    expect(found[0].characters).toBe('Title')
  })

  test('findAll without callback returns all', () => {
    const api = createAPI()
    const parent = api.createFrame()
    const a = api.createRectangle()
    const b = api.createText()
    parent.appendChild(a)
    parent.appendChild(b)
    expect(parent.findAll().length).toBe(2)
  })

  test('findOne returns first match', () => {
    const api = createAPI()
    const parent = api.createFrame()
    const a = api.createRectangle()
    a.name = 'First'
    const b = api.createRectangle()
    b.name = 'Second'
    parent.appendChild(a)
    parent.appendChild(b)
    const found = parent.findOne((n) => n.type === 'RECTANGLE')
    expect(expectDefined(found, 'first rectangle').name).toBe('First')
  })

  test('findChild searches direct children only', () => {
    const api = createAPI()
    const parent = api.createFrame()
    const child = api.createFrame()
    const deep = api.createText()
    deep.name = 'Deep'
    parent.appendChild(child)
    child.appendChild(deep)

    expect(parent.findChild((n) => n.name === 'Deep')).toBeNull()
    expect(child.findChild((n) => n.name === 'Deep')).not.toBeNull()
  })

  test('findChildren returns direct children matching', () => {
    const api = createAPI()
    const parent = api.createFrame()
    const a = api.createRectangle()
    const b = api.createText()
    const c = api.createRectangle()
    parent.appendChild(a)
    parent.appendChild(b)
    parent.appendChild(c)
    const rects = parent.findChildren((n) => n.type === 'RECTANGLE')
    expect(rects.length).toBe(2)
  })
})
