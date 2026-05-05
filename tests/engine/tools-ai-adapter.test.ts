import { describe, expect, test } from 'bun:test'

import { valibotSchema } from '@ai-sdk/valibot'
import { tool } from 'ai'
import * as v from 'valibot'

import { ALL_TOOLS, FigmaAPI, SceneGraph, toolsToAI } from '@open-pencil/core'

type AdapterTool = { execute(args: Record<string, unknown>): Promise<unknown>; description: string }

function adapterTool(tools: Record<string, unknown>, name: string): AdapterTool {
  return tools[name] as AdapterTool
}

function setup() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)

  const tools = toolsToAI(
    ALL_TOOLS,
    {
      getFigma: () => figma,
      onAfterExecute: () => {}
    },
    { v, valibotSchema, tool }
  )

  return { graph, figma, tools }
}

describe('AI adapter', () => {
  test('generates tool for every definition', () => {
    const { tools } = setup()
    for (const def of ALL_TOOLS) {
      expect(tools[def.name]).toBeDefined()
    }
    expect(Object.keys(tools).length).toBe(ALL_TOOLS.length)
  })

  test('each tool has description and execute', () => {
    const { tools } = setup()
    for (const [name, t] of Object.entries(tools)) {
      const aiTool = t as AdapterTool
      expect(aiTool.description).toBeTruthy()
      expect(typeof aiTool.execute).toBe('function')
    }
  })

  test('create_shape tool works through adapter', async () => {
    const { tools, figma } = setup()
    const createShape = adapterTool(tools, 'create_shape')
    const result = (await createShape.execute({
      type: 'RECTANGLE',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      name: 'Test Rect'
    })) as { id: string; type: string; name: string }

    expect(result.id).toBeTruthy()
    expect(result.type).toBe('RECTANGLE')
    expect(result.name).toBe('Test Rect')

    const node = figma.getNodeById(result.id)!
    expect(node.x).toBe(10)
    expect(node.y).toBe(20)
    expect(node.width).toBe(100)
  })

  test('set_fill tool works through adapter', async () => {
    const { tools, figma } = setup()
    const rect = figma.createRectangle()
    rect.resize(100, 100)

    const setFill = adapterTool(tools, 'set_fill')
    await setFill.execute({ id: rect.id, color: '#00ff00' })

    const fills = figma.getNodeById(rect.id)!.fills
    expect(fills.length).toBe(1)
    expect(fills[0].color.g).toBeCloseTo(1)
  })

  test('get_page_tree tool returns structure', async () => {
    const { tools, figma } = setup()
    const frame = figma.createFrame()
    frame.name = 'TestFrame'
    frame.resize(200, 200)
    const rect = figma.createRectangle()
    rect.resize(50, 50)
    frame.appendChild(rect)

    const getTree = adapterTool(tools, 'get_page_tree')
    const result = (await getTree.execute({})) as { page: unknown; children: unknown[] }
    expect(result.page).toBeTruthy()
    expect(result.children.length).toBeGreaterThan(0)
  })

  test('onBeforeExecute and onAfterExecute are called', async () => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    const calls: string[] = []

    const tools = toolsToAI(
      ALL_TOOLS,
      {
        getFigma: () => figma,
        onBeforeExecute: () => calls.push('before'),
        onAfterExecute: () => calls.push('after')
      },
      { v, valibotSchema, tool }
    )

    const listPages = adapterTool(tools, 'list_pages')
    await listPages.execute({})

    expect(calls).toEqual(['before', 'after'])
  })

  test('onAfterExecute called even on error', async () => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    let afterCalled = false

    const tools = toolsToAI(
      ALL_TOOLS,
      {
        getFigma: () => figma,
        onAfterExecute: () => {
          afterCalled = true
        }
      },
      { v, valibotSchema, tool }
    )

    const evalTool = adapterTool(tools, 'eval')
    try {
      await evalTool.execute({ code: 'throw new Error("test")' })
    } catch {
      // expected
    }

    expect(afterCalled).toBe(true)
  })

  test('find_nodes works through adapter', async () => {
    const { tools, figma } = setup()
    figma.createRectangle().name = 'Button'
    figma.createText().name = 'Label'
    figma.createRectangle().name = 'Button Secondary'

    const findNodes = adapterTool(tools, 'find_nodes')
    const result = (await findNodes.execute({ name: 'button' })) as { count: number }
    expect(result.count).toBe(2)
  })

  test('set_layout works through adapter', async () => {
    const { tools, figma } = setup()
    const frame = figma.createFrame()
    frame.resize(300, 200)

    const setLayout = adapterTool(tools, 'set_layout')
    await setLayout.execute({
      id: frame.id,
      direction: 'HORIZONTAL',
      spacing: 8,
      padding: 16
    })

    const node = figma.getNodeById(frame.id)!
    expect(node.layoutMode).toBe('HORIZONTAL')
    expect(node.itemSpacing).toBe(8)
    expect(node.paddingLeft).toBe(16)
  })

  test('render JSX works through adapter', async () => {
    const { tools } = setup()
    const render = adapterTool(tools, 'render')
    const result = (await render.execute({
      jsx: '<Frame name="Card" w={200} h={100}><Text>Hello</Text></Frame>'
    })) as { name: string; type: string }
    expect(result.name).toBe('Card')
    expect(result.type).toBe('FRAME')
  })

  test('delete + get returns error for removed node', async () => {
    const { tools, figma } = setup()
    const rect = figma.createRectangle()
    const id = rect.id

    const deleteTool = adapterTool(tools, 'delete_node')
    await deleteTool.execute({ id })

    const getNode = adapterTool(tools, 'get_node')
    const result = (await getNode.execute({ id })) as { error: string }
    expect(result.error).toContain('not found')
  })
})
