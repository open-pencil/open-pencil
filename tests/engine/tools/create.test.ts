import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#tests/helpers/assert'
import { getTool, setupToolTest, type ToolResult } from '#tests/helpers/tools'

describe('create_shape', () => {
  test('creates a frame', () => {
    const { figma } = setupToolTest()
    const tool = getTool('create_shape')
    const result = tool.execute(figma, {
      type: 'FRAME',
      x: 100,
      y: 200,
      width: 300,
      height: 400,
      name: 'Test Frame'
    }) as ToolResult
    expect(result.name).toBe('Test Frame')
    expect(result.type).toBe('FRAME')

    const node = expectDefined(
      figma.getNodeById(expectDefined(result.id, 'created node id')),
      'created node'
    )
    expect(node.x).toBe(100)
    expect(node.y).toBe(200)
    expect(node.width).toBe(300)
    expect(node.height).toBe(400)
  })

  test('creates nested inside parent', () => {
    const { figma } = setupToolTest()
    const tool = getTool('create_shape')
    const parent = tool.execute(figma, {
      type: 'FRAME',
      x: 0,
      y: 0,
      width: 500,
      height: 500,
      name: 'Parent'
    }) as ToolResult
    const child = tool.execute(figma, {
      type: 'RECTANGLE',
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      parent_id: parent.id
    }) as ToolResult

    const parentNode = expectDefined(
      figma.getNodeById(expectDefined(parent.id, 'created parent id')),
      'created parent node'
    )
    expect(parentNode.children.some((c) => c.id === child.id)).toBe(true)
  })
})

describe('render', () => {
  test('renders JSX string', async () => {
    const { figma } = setupToolTest()
    const tool = getTool('render')
    const result = (await tool.execute(figma, {
      jsx: '<Frame name="Card" w={200} h={100} bg="#FFF"><Text>Hello</Text></Frame>'
    })) as ToolResult
    expect(result.name).toBe('Card')
    expect(result.type).toBe('FRAME')
    expect(result.children.length).toBeGreaterThan(0)
  })
})
