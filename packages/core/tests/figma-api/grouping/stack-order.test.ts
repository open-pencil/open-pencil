import { describe, expect, test } from 'bun:test'

import { createStackHost } from '#core-tests/helpers/figma-api'

// Recorded with the same script in Figma desktop 126.

describe('group and boolean stack order', () => {
  test('a group without an index goes on top of its parent', () => {
    const { figma, host, rect, order } = createStackHost()
    rect('a', 0)
    const b = rect('b', 100)
    const c = rect('c', 200)
    rect('d', 300)
    const group = figma.group([b, c], host)
    expect(group.name).toBe('Group')
    expect(order()).toEqual(['a', 'd', 'Group'])
  })

  test('ungroup puts the children in the group’s place in the stack', () => {
    const { figma, host, rect, order } = createStackHost()
    rect('a', 0)
    const b = rect('b', 100)
    const c = rect('c', 200)
    rect('d', 300)
    const group = figma.group([b, c], host, 1)
    expect(order()).toEqual(['a', 'Group', 'd'])
    expect(figma.ungroup(group).map((child) => child.name)).toEqual(['b', 'c'])
    expect(order()).toEqual(['a', 'b', 'c', 'd'])
  })

  test('a boolean operation is named after it and filled with the default grey', () => {
    const { figma, host, rect, order } = createStackHost()
    rect('a', 0)
    const b = rect('b', 100)
    const c = rect('c', 120)
    // Scripts pass Figma paints, which carry no alpha.
    Reflect.set(b, 'fills', [{ type: 'SOLID', color: { r: 0, g: 1, b: 0 } }])
    const union = figma.union([b, c], host)
    expect(union.name).toBe('Union')
    expect(order()).toEqual(['a', 'Union'])
    const raw = figma.graph.getNode(union.id)
    expect(raw?.fills[0]?.color.r).toBeCloseTo(217 / 255)
    expect(raw?.childIds).toEqual([b.id, c.id])
    expect(figma.subtract([rect('e', 0), rect('f', 10)], host).name).toBe('Subtract')
  })
})
