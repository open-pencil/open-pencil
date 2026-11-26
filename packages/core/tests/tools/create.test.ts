import { describe, expect, test } from 'bun:test'

import { getTool, runTool, setupToolTest, type ToolResult } from '#core-tests/helpers/tools'
import * as v from 'valibot'

import { toolJSONSchema } from '@open-pencil/core/tools'
import { expectDefined } from '@open-pencil/test-support/assert'
/** The `render` tool answers with the rendered root and its child IDs. */
interface RenderToolResult extends ToolResult {
  children: string[]
}

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

  async function createText(size: { width?: number; height?: number }, inAutoLayout = false) {
    const { figma } = setupToolTest()
    const frame = inAutoLayout ? figma.createFrame() : null
    if (frame) frame.layoutMode = 'VERTICAL'
    const parent = frame ? { parent_id: frame.id } : {}
    const args = { type: 'TEXT', x: 0, y: 0, ...size, ...parent }
    const result = (await runTool(figma, 'create_shape', args)) as ToolResult
    const id = expectDefined(result.id, 'created text id')
    return { figma, frame, node: expectDefined(figma.getNodeById(id), 'created text') }
  }

  function setLabel({ figma, node }: Awaited<ReturnType<typeof createText>>, text: string) {
    return runTool(figma, 'set_text', { id: node.id, text })
  }

  const LONG_LABEL = 'A label long enough to take more than one line when it wraps'

  test('text without a size grows with its characters', async () => {
    const created = await createText({})
    expect(created.node.textAutoResize).toBe('WIDTH_AND_HEIGHT')
    await setLabel(created, 'Hi')
    const { width, height } = created.node
    await setLabel(created, LONG_LABEL)
    expect(created.node.textAutoResize).toBe('WIDTH_AND_HEIGHT')
    expect(created.node.width).toBeGreaterThan(width)
    expect(created.node.height).toBe(height)
  })

  test('text given its initial height keeps that height', async () => {
    const { height } = setupToolTest().figma.createText()
    const created = await createText({ width: 80, height })
    expect(created.node.textAutoResize).toBe('NONE')
    await setLabel(created, LONG_LABEL)
    expect(created.node.width).toBe(80)
    expect(created.node.height).toBe(height)
  })

  test('text with only a width wraps in it', async () => {
    const created = await createText({ width: 120 })
    expect(created.node.textAutoResize).toBe('HEIGHT')
    await setLabel(created, 'Hi')
    const { height } = created.node
    await setLabel(created, LONG_LABEL)
    expect(created.node.width).toBe(120)
    expect(created.node.height).toBeGreaterThan(height)
  })

  test('text with a width and a height keeps both', async () => {
    const created = await createText({ width: 120, height: 30 })
    await setLabel(created, LONG_LABEL)
    expect(created.node.textAutoResize).toBe('NONE')
    expect([created.node.width, created.node.height]).toEqual([120, 30])
  })

  test('text without a size stays auto width in an auto layout frame', async () => {
    const created = await createText({}, true)
    await setLabel(created, 'Hi')
    expect(created.node.parent?.id).toBe(expectDefined(created.frame, 'parent frame').id)
    expect(created.node.textAutoResize).toBe('WIDTH_AND_HEIGHT')
    expect(created.node.width).toBeLessThan(100)
  })

  test.each([
    [{ type: 'TEXT', height: 30 }, 'width'],
    [{ type: 'RECTANGLE', height: 30 }, 'width'],
    [{ type: 'FRAME', width: 30 }, 'height'],
    [{ type: 'LINE' }, 'width']
  ])('refuses %j, naming the missing size, and creates nothing', (args, missing) => {
    const { figma } = setupToolTest()
    const result = getTool('create_shape').execute(figma, { x: 0, y: 0, ...args })
    expect(result).toMatchObject({ error: expect.stringContaining(`needs a ${missing}`) })
    expect(figma.currentPage.children).toHaveLength(0)
  })

  test('names every supported node type in the tool description', () => {
    const tool = getTool('create_shape')
    const property = toolJSONSchema(tool.input, { typeMode: 'input' }).properties?.type
    const supportedTypes = v.parse(
      v.array(v.string()),
      typeof property === 'object' ? property.enum : undefined
    )

    expect(supportedTypes.length).toBeGreaterThan(0)
    expect(supportedTypes.filter((type) => !tool.description.includes(type))).toEqual([])
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

describe('combine_as_variants', () => {
  test('rejects components from different parents', () => {
    const { figma } = setupToolTest()
    const firstParent = figma.createFrame()
    const secondParent = figma.createFrame()
    const first = figma.createComponent()
    const second = figma.createComponent()
    firstParent.appendChild(first)
    secondParent.appendChild(second)

    const result = getTool('combine_as_variants').execute(figma, {
      ids: [first.id, second.id]
    }) as ToolResult

    expect(result.error).toBe('combineAsVariants requires components to share a parent')
    expect(first.parent?.id).toBe(firstParent.id)
    expect(second.parent?.id).toBe(secondParent.id)
  })
})

describe('render', () => {
  test('renders JSX string', async () => {
    const { figma } = setupToolTest()
    const tool = getTool('render')
    const result = (await tool.execute(figma, {
      jsx: '<Frame name="Card" w={200} h={100} bg="#FFF"><Text>Hello</Text></Frame>'
    })) as RenderToolResult
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

  test('accepts SVG markup attributes without hiding invalid root props', async () => {
    const { figma } = setupToolTest()
    const render = getTool('render')
    const valid = (await render.execute(figma, {
      jsx: '<svg name="Boat" viewBox="0 0 640 700" size={600}><path d="M380 40 L380 560" stroke="#021A3B" stroke-width="6" fill="none" /></svg>'
    })) as ToolResult
    const invalid = (await render.execute(figma, {
      jsx: '<svg viewBox="0 0 1 1" mt={8}><path d="M0 0 L1 1" /></svg>'
    })) as ToolResult

    expect(valid.warnings).toBeUndefined()
    expect(invalid.warnings).toEqual(['Unsupported prop "mt" on <svg> is ignored.'])
  })

  test('get_node exposes text style fields', async () => {
    const { figma } = setupToolTest()
    const render = getTool('render')
    const card = (await render.execute(figma, {
      jsx: '<Frame name="Card" w={200} h={100}><Text name="Title" size={24} weight={700} font="Inter" color="#111" textAlign="center">Hello</Text></Frame>'
    })) as ToolResult
    const textId = (card.children as string[])[0]
    const getNode = getTool('get_node')
    const result = (await getNode.execute(figma, { id: textId, depth: 0 })) as ToolResult

    expect(result.characters).toBe('Hello')
    expect(result.fontFamily).toBe('Inter')
    expect(result.fontSize).toBe(24)
    expect(result.fontWeight).toBe(700)
    expect(result.textAlignHorizontal).toBe('CENTER')
  })
})

describe('create_vector', () => {
  test('creates tightly bounded curved geometry from SVG path data', () => {
    const { figma, graph } = setupToolTest()
    const result = getTool('create_vector').execute(figma, {
      x: 100,
      y: 200,
      name: 'Curved outline',
      path: 'M10 20 C20 20 30 40 40 40 L10 40 Z'
    }) as ToolResult
    const node = expectDefined(
      graph.getNode(expectDefined(result.id, 'created vector id')),
      'created vector'
    )
    const network = expectDefined(node.vectorNetwork, 'SVG vector network')

    expect({ x: node.x, y: node.y, width: node.width, height: node.height }).toEqual({
      x: 100,
      y: 200,
      width: 30,
      height: 20
    })
    expect(network.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 30, y: 20 },
      { x: 0, y: 20 }
    ])
    expect(network.segments[0]?.tangentStart).toEqual({ x: 10, y: 0 })
    expect(network.segments[0]?.tangentEnd).toEqual({ x: -10, y: 0 })
    expect(network.regions).toEqual([{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }])
  })

  test('preserves complete VectorNetwork JSON topology', () => {
    const { figma, graph } = setupToolTest()
    const result = getTool('create_vector').execute(figma, {
      x: 0,
      y: 0,
      path: JSON.stringify({
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 0, y: 10 }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 1, y: 0 }, tangentEnd: { x: -1, y: 0 } },
          { start: 1, end: 2 },
          { start: 2, end: 0 }
        ],
        regions: [{ windingRule: 'EVENODD', loops: [[0, 1, 2]] }]
      })
    }) as ToolResult
    const node = expectDefined(
      graph.getNode(expectDefined(result.id, 'created vector id')),
      'created vector'
    )

    expect(node.vectorNetwork).toEqual({
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 }
      ],
      segments: [
        {
          start: 0,
          end: 1,
          tangentStart: { x: 1, y: 0 },
          tangentEnd: { x: -1, y: 0 }
        },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 2, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: [{ windingRule: 'EVENODD', loops: [[0, 1, 2]] }]
    })
  })

  test('rejects invalid supplied paths before creating a node', () => {
    const { figma, graph } = setupToolTest()
    const tool = getTool('create_vector')
    const before = graph.nodes.size

    for (const path of ['', 'not a path', 'null', 'M0 0 L', 'M0 0 L0 0']) {
      const result = tool.execute(figma, { x: 0, y: 0, name: 'Ghost', path }) as ToolResult
      expect(result.error).toBeDefined()
      expect(graph.nodes.size).toBe(before)
    }
  })
})
