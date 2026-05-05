import { describe, expect, test } from 'bun:test'

import { getTool, setupToolTest, type ToolResult } from '#tests/helpers/tools'

describe('delete_node', () => {
  test('removes a node', () => {
    const { figma } = setupToolTest()
    const rect = figma.createRectangle()

    const tool = getTool('delete_node')
    tool.execute(figma, { id: rect.id })

    expect(figma.getNodeById(rect.id)).toBeNull()
  })
})

describe('clone_node', () => {
  test('duplicates a node', () => {
    const { figma } = setupToolTest()
    const rect = figma.createRectangle()
    rect.name = 'Original'
    rect.resize(100, 100)

    const tool = getTool('clone_node')
    const result = tool.execute(figma, { id: rect.id }) as ToolResult

    expect(result.id).not.toBe(rect.id)
    expect(result.name).toBe('Original')
  })
})

describe('rename_node', () => {
  test('renames a node', () => {
    const { figma } = setupToolTest()
    const rect = figma.createRectangle()

    const tool = getTool('rename_node')
    tool.execute(figma, { id: rect.id, name: 'My Rectangle' })

    expect(figma.getNodeById(rect.id)!.name).toBe('My Rectangle')
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

    expect(figma.getNodeById(frame.id)!.children.some((c) => c.id === rect.id)).toBe(true)
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
    const group = figma.getNodeById(result.id)!
    expect(group.children.length).toBe(2)
  })
})
