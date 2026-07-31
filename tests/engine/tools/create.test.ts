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

describe('create_vector', () => {
  const STAR_D = 'M50 0 L61 35 L98 35 L68 57 L79 91 L50 70 L21 91 L32 57 L2 35 L39 35 Z'

  test('accepts an SVG path string', () => {
    const { figma, graph } = setupToolTest()
    const tool = getTool('create_vector')
    const result = tool.execute(figma, {
      x: 10,
      y: 20,
      name: 'Star',
      path: STAR_D
    }) as ToolResult

    const node = expectDefined(
      graph.getNode(expectDefined(result.id, 'created node id')),
      'created node'
    )
    // The whole point: an LLM-authored `d` string has to yield real geometry,
    // not a zero-path node that silently renders nothing.
    const network = expectDefined(node.vectorNetwork, 'vector network')
    expect(network.vertices.length).toBeGreaterThan(0)
    expect(network.regions.length).toBeGreaterThan(0)
  })

  test('still accepts VectorNetwork JSON', () => {
    const { figma, graph } = setupToolTest()
    const tool = getTool('create_vector')
    const result = tool.execute(figma, {
      x: 0,
      y: 0,
      path: JSON.stringify({
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 }
        ],
        segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: []
      })
    }) as ToolResult

    const node = expectDefined(
      graph.getNode(expectDefined(result.id, 'created node id')),
      'created node'
    )
    expect(expectDefined(node.vectorNetwork, 'vector network').vertices.length).toBe(2)
  })

  test('rejects bad path data without leaving an orphaned node behind', () => {
    const { figma, graph } = setupToolTest()
    const tool = getTool('create_vector')
    const before = [...graph.getAllNodes()].length

    const result = tool.execute(figma, { x: 0, y: 0, name: 'Ghost', path: 'not a path' })

    expect(expectDefined(result, 'result').error).toBeDefined()
    // Regression: the node used to be created and named before the path was
    // parsed, so every rejected attempt left an invisible paths:0 node.
    expect([...graph.getAllNodes()].length).toBe(before)
  })
})
