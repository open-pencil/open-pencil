import { describe, expect, test } from 'bun:test'

import { createAPI } from './helpers'

describe('FigmaAPI grouping compatibility', () => {
  test('group accepts parent and index and returns a group node', () => {
    const api = createAPI()
    const page = api.currentPage
    const before = api.createRectangle()
    const first = api.createRectangle()
    const second = api.createRectangle()

    const group = api.group([first, second], page, 1)

    expect(group.type).toBe('GROUP')
    expect(group.children.map((child) => child.id)).toEqual([first.id, second.id])
    expect(page.children.map((child) => child.id)).toEqual([before.id, group.id])
  })

  test('group spans its children', () => {
    const api = createAPI()
    const first = api.createRectangle()
    first.x = 10
    first.y = 20
    first.resize(30, 30)
    const second = api.createRectangle()
    second.x = 60
    second.y = 70
    second.resize(20, 20)

    const group = api.group([first, second], api.currentPage)

    expect([group.x, group.y, group.width, group.height]).toEqual([10, 20, 70, 70])
    expect(first.absoluteBoundingBox).toMatchObject({ x: 10, y: 20, width: 30, height: 30 })
    expect(second.absoluteBoundingBox).toMatchObject({ x: 60, y: 70, width: 20, height: 20 })
  })

  test('group inside a frame is placed in the frame', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.x = 100
    frame.y = 200
    frame.resize(300, 300)
    const first = api.createRectangle()
    frame.appendChild(first)
    first.x = 10
    first.y = 20
    first.resize(30, 30)
    const second = api.createRectangle()
    frame.appendChild(second)
    second.x = 60
    second.y = 70
    second.resize(20, 20)

    const group = api.group([first, second], frame)

    expect([group.x, group.y, group.width, group.height]).toEqual([10, 20, 70, 70])
    expect(first.absoluteBoundingBox).toMatchObject({ x: 110, y: 220 })
    expect(second.absoluteBoundingBox).toMatchObject({ x: 160, y: 270 })
  })

  test('group and boolean operation inside a rotated frame use the frame axes', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.x = 100
    frame.y = 200
    frame.resize(300, 300)
    frame.rotation = 90
    const make = () => {
      const first = api.createRectangle()
      frame.appendChild(first)
      first.x = 10
      first.y = 20
      first.resize(30, 30)
      const second = api.createRectangle()
      frame.appendChild(second)
      second.x = 60
      second.y = 70
      second.resize(20, 20)
      return [first, second]
    }

    const group = api.group(make(), frame)
    const booleanNode = api.union(make(), frame)

    for (const node of [group, booleanNode]) {
      expect(node.x).toBeCloseTo(10, 6)
      expect(node.y).toBeCloseTo(20, 6)
      expect(node.width).toBeCloseTo(70, 6)
      expect(node.height).toBeCloseTo(70, 6)
    }
  })

  test('ungroup returns moved children', () => {
    const api = createAPI()
    const page = api.currentPage
    const first = api.createRectangle()
    const second = api.createRectangle()
    const group = api.group([first, second], page)

    const children = api.ungroup(group)

    expect(children.map((child) => child.id)).toEqual([first.id, second.id])
    expect(api.getNodeById(group.id)).toBeNull()
    expect(page.children.map((child) => child.id)).toEqual([first.id, second.id])
  })

  test('flatten accepts proxy nodes and optional parent/index', () => {
    const api = createAPI()
    const page = api.currentPage
    const before = api.createRectangle()
    const first = api.createRectangle()
    const second = api.createRectangle()

    const vector = api.flatten([first, second], page, 1)

    expect(vector.type).toBe('VECTOR')
    expect(api.getNodeById(first.id)).toBeNull()
    expect(api.getNodeById(second.id)).toBeNull()
    expect(page.children.map((child) => child.id)).toEqual([before.id, vector.id])
  })

  test('boolean wrappers create boolean operation containers', () => {
    const api = createAPI()
    const page = api.currentPage
    const before = api.createRectangle()
    const first = api.createRectangle()
    const second = api.createRectangle()

    const booleanNode = api.union([first, second], page, 1)

    expect(booleanNode.type).toBe('BOOLEAN_OPERATION')
    expect(booleanNode.children.map((child) => child.id)).toEqual([first.id, second.id])
    expect(page.children.map((child) => child.id)).toEqual([before.id, booleanNode.id])
  })

  test('boolean operations span all operands', () => {
    const api = createAPI()
    const first = api.createRectangle()
    first.x = 10
    first.y = 20
    first.resize(30, 30)
    const second = api.createRectangle()
    second.x = 60
    second.y = 70
    second.resize(20, 20)

    const booleanNode = api.union([first, second], api.currentPage)

    expect([booleanNode.x, booleanNode.y, booleanNode.width, booleanNode.height]).toEqual([
      10, 20, 70, 70
    ])
    expect(first.absoluteBoundingBox).toMatchObject({ x: 10, y: 20, width: 30, height: 30 })
    expect(second.absoluteBoundingBox).toMatchObject({ x: 60, y: 70, width: 20, height: 20 })
  })

  test('boolean operations inside a frame are placed in the frame', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.x = 100
    frame.y = 200
    frame.resize(300, 300)
    const first = api.createRectangle()
    frame.appendChild(first)
    first.x = 10
    first.y = 20
    first.resize(30, 30)
    const second = api.createRectangle()
    frame.appendChild(second)
    second.x = 60
    second.y = 70
    second.resize(20, 20)

    const booleanNode = api.subtract([first, second], frame)

    expect([booleanNode.x, booleanNode.y, booleanNode.width, booleanNode.height]).toEqual([
      10, 20, 70, 70
    ])
    expect(first.absoluteBoundingBox).toMatchObject({ x: 110, y: 220 })
    expect(second.absoluteBoundingBox).toMatchObject({ x: 160, y: 270 })
  })
})
