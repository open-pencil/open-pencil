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

  test('returns JSX warnings', async () => {
    const { figma } = setupToolTest()
    const tool = getTool('render')
    const result = (await tool.execute(figma, {
      jsx: '<Frame name="Card" w={200} h={100} mt={8} />'
    })) as ToolResult
    expect(result.warnings).toEqual(['Unsupported prop "mt" on <frame> is ignored.'])
  })

  test('get_node exposes text style fields', async () => {
    const { figma } = setupToolTest()
    const render = getTool('render')
    const card = (await render.execute(figma, {
      jsx: '<Frame name="Card" w={200} h={100}><Text name="Title" size={24} weight={700} font="Inter" color="#111" textAlign="center">Hello</Text></Frame>'
    })) as ToolResult
    const textId = (card.children as string[])[0]
    const getNode = getTool('get_node')
    const result = getNode.execute(figma, { id: textId, depth: 0 }) as ToolResult

    expect(result.characters).toBe('Hello')
    expect(result.fontFamily).toBe('Inter')
    expect(result.fontSize).toBe(24)
    expect(result.fontWeight).toBe(700)
    expect(result.textAlignHorizontal).toBe('CENTER')
  })
})

describe('render discoverability', () => {
  test('describes the <svg> path route for arbitrary shapes', () => {
    // Agents reach for eval + figma.createVector() when nothing tells them the
    // render tool can take path data, then hand-build geometry and fail.
    const description = getTool('render').description
    expect(description).toContain('<svg')
    expect(description).toContain('path')
  })

  test('renders <svg> path children as stroked vector nodes', async () => {
    const { figma, graph } = setupToolTest()
    const result = (await getTool('render').execute(figma, {
      jsx: '<svg name="Boat" viewBox="0 0 640 700" size={600}><path d="M380 40 L380 560" stroke="#021A3B" stroke-width="6" fill="none" /><path d="M100 560 C175 695 585 695 660 560 Z" stroke="#021A3B" stroke-width="6" fill="none" /></svg>'
    })) as ToolResult

    const childIds = (result.children as string[] | undefined) ?? []
    expect(childIds.length).toBe(2)
    for (const id of childIds) {
      const node = expectDefined(graph.getNode(id), 'rendered path node')
      // The open path (a bare line) must survive with geometry and a stroke —
      // that is the case a single shared vector network used to drop.
      expect(expectDefined(node.vectorNetwork, 'vector network').vertices.length).toBeGreaterThan(0)
      expect(node.strokes.length).toBeGreaterThan(0)
    }
  })
})
