import { describe, expect, test } from 'bun:test'

import { createAPI } from '../helpers'

describe('combineAsVariants', () => {
  test('wraps components into a COMPONENT_SET', () => {
    const api = createAPI()
    const a = api.createComponent()
    a.name = 'Button/Primary'
    a.resize(100, 40)
    const b = api.createComponent()
    b.name = 'Button/Secondary'
    b.resize(100, 40)

    const set = api.combineAsVariants([a, b], api.currentPage)

    expect(set.type).toBe('COMPONENT_SET')
    expect(set.name).toBe('Button')
    expect(set.children.length).toBe(2)
    expect(set.children.map((child) => child.name).sort()).toEqual(['Primary', 'Secondary'])
  })

  test('derives variant property definitions from name segments', () => {
    const api = createAPI()
    const a = api.createComponent()
    a.name = 'State/Default'
    a.resize(100, 40)
    const b = api.createComponent()
    b.name = 'State/Hover'
    b.resize(100, 40)

    const set = api.combineAsVariants([a, b], api.currentPage)
    const raw = api.graph.getNode(set.id)

    expect(raw?.componentPropertyDefinitions?.length).toBe(1)
    expect(raw?.componentPropertyDefinitions?.[0].name).toBe('Variant')
    expect(raw?.componentPropertyDefinitions?.[0].variantOptions?.sort()).toEqual([
      'Default',
      'Hover'
    ])
  })

  test('accepts one component and an explicit destination', () => {
    const api = createAPI()
    const destination = api.createFrame()
    const component = api.createComponent()

    const set = api.combineAsVariants([component], destination)

    expect(set.parent?.id).toBe(destination.id)
    expect(set.children.map((child) => child.id)).toEqual([component.id])
  })

  test('uses the requested insertion index and preserves absolute positions', () => {
    const api = createAPI()
    const before = api.createFrame()
    const a = api.createComponent()
    a.x = 120
    a.y = 80
    const b = api.createComponent()
    b.x = 260
    b.y = 160
    const originalPositions = [a.absoluteTransform, b.absoluteTransform]

    const set = api.combineAsVariants([a, b], api.currentPage, 0)

    expect(api.currentPage.children[0].id).toBe(set.id)
    expect(before.parent?.id).toBe(api.currentPage.id)
    expect([a.absoluteTransform, b.absoluteTransform]).toEqual(originalPositions)
  })

  test('rejects an empty list', () => {
    const api = createAPI()
    expect(() => api.combineAsVariants([], api.currentPage)).toThrow()
  })

  test('rejects duplicate component references', () => {
    const api = createAPI()
    const component = api.createComponent()
    expect(() => api.combineAsVariants([component, component], api.currentPage)).toThrow('distinct')
  })

  test('rejects non-component nodes', () => {
    const api = createAPI()
    const component = api.createComponent()
    const frame = api.createFrame()
    expect(() => api.combineAsVariants([component, frame], api.currentPage)).toThrow()
  })
})
