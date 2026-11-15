import { describe, expect, test } from 'bun:test'

import { getTool, setupToolTest, type ToolResult } from '#core-tests/helpers/tools'

import { expectDefined } from '@open-pencil/test-support/assert'
describe('delete_nodes', () => {
  test('removes nodes, including one inside another', () => {
    const { figma } = setupToolTest()
    const frame = figma.createFrame()
    const inner = figma.createRectangle()
    frame.appendChild(inner)
    const rect = figma.createRectangle()

    const tool = getTool('delete_nodes')
    tool.execute(figma, { ids: [frame.id, inner.id, rect.id] })

    expect(figma.getNodeById(frame.id)).toBeNull()
    expect(figma.getNodeById(inner.id)).toBeNull()
    expect(figma.getNodeById(rect.id)).toBeNull()
  })

  test('deletes nothing when a node is missing', () => {
    const { figma } = setupToolTest()
    const rect = figma.createRectangle()

    expect(getTool('delete_nodes').execute(figma, { ids: [rect.id, 'missing'] })).toEqual({
      error: 'One or more node IDs were not found'
    })
    expect(figma.getNodeById(rect.id)).not.toBeNull()
  })
})

describe('ungroup_nodes', () => {
  test('ungroups each group, keeping its children', () => {
    const { figma } = setupToolTest()
    const groups = [0, 1].map(() => {
      const rect = figma.createRectangle()
      return { rect, group: figma.group([rect], figma.currentPage) }
    })

    getTool('ungroup_nodes').execute(figma, { ids: groups.map(({ group }) => group.id) })

    for (const { rect, group } of groups) {
      expect(figma.getNodeById(group.id)).toBeNull()
      expect(figma.getNodeById(rect.id)?.parent?.id).toBe(figma.currentPage.id)
    }
  })
})

describe('get_bounds', () => {
  test("gives a node's box, or the page's without an ID", () => {
    const { figma } = setupToolTest()
    const a = figma.createRectangle()
    a.x = 10
    a.y = 20
    a.resize(30, 40)
    const b = figma.createRectangle()
    b.x = 100
    b.y = 0
    b.resize(10, 10)

    const tool = getTool('get_bounds')
    expect(tool.execute(figma, { id: a.id })).toEqual({
      id: a.id,
      bounds: { x: 10, y: 20, width: 30, height: 40 }
    })
    expect(tool.execute(figma, {})).toMatchObject({ x: 10, y: 0, width: 100, height: 60 })
  })
})

describe('clone_nodes', () => {
  test('duplicates a node', () => {
    const { figma } = setupToolTest()
    const rect = figma.createRectangle()
    rect.name = 'Original'
    rect.resize(100, 100)

    const tool = getTool('clone_nodes')
    const { clones } = tool.execute(figma, { ids: [rect.id] }) as { clones: ToolResult[] }

    expect(clones).toHaveLength(1)
    expect(clones[0].id).not.toBe(rect.id)
    expect(clones[0].name).toBe('Original')
  })
})

describe('reparent_node', () => {
  test('moves node into frame', () => {
    const { figma } = setupToolTest()
    const frame = figma.createFrame()
    frame.resize(300, 300)
    const rect = figma.createRectangle()
    rect.resize(50, 50)

    const tool = getTool('reparent_node')
    tool.execute(figma, { id: rect.id, parent_id: frame.id })

    expect(
      expectDefined(figma.getNodeById(frame.id), 'target frame').children.some(
        (c) => c.id === rect.id
      )
    ).toBe(true)
  })
})

describe('group_nodes', () => {
  test('groups two nodes', () => {
    const { figma } = setupToolTest()
    const r1 = figma.createRectangle()
    r1.resize(50, 50)
    const r2 = figma.createRectangle()
    r2.resize(50, 50)

    const tool = getTool('group_nodes')
    const result = tool.execute(figma, { ids: [r1.id, r2.id] }) as ToolResult

    expect(result.type).toBe('GROUP')
    const group = expectDefined(
      figma.getNodeById(expectDefined(result.id, 'group id')),
      'created group'
    )
    expect(group.children.length).toBe(2)
  })
})
