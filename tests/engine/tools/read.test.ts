import { describe, expect, test } from 'bun:test'

import { ALL_TOOLS, getTool, setupToolTest, type ToolResult } from '#tests/helpers/tools'

import { FigmaAPI } from '@open-pencil/core'

describe('find_nodes', () => {
  test('finds by name', () => {
    const { figma } = setupToolTest()
    const rect = figma.createRectangle()
    rect.name = 'Button Primary'
    const text = figma.createText()
    text.name = 'Label'

    const tool = getTool('find_nodes')
    const result = tool.execute(figma, { name: 'button' }) as ToolResult
    expect(result.count).toBe(1)
    expect(result.nodes[0].name).toBe('Button Primary')
  })

  test('finds by type', () => {
    const { figma } = setupToolTest()
    figma.createRectangle()
    figma.createRectangle()
    figma.createText()

    const tool = getTool('find_nodes')
    const result = tool.execute(figma, { type: 'RECTANGLE' }) as ToolResult
    expect(result.count).toBe(2)
  })
})

describe('query_nodes', () => {
  test('finds all frames with //FRAME', async () => {
    const { figma } = setupToolTest()
    const f1 = figma.createFrame()
    f1.resize(200, 200)
    f1.name = 'Frame A'
    const f2 = figma.createFrame()
    f2.resize(300, 300)
    f2.name = 'Frame B'
    figma.createRectangle()

    const tool = getTool('query_nodes')
    const result = (await tool.execute(figma, { selector: '//FRAME' })) as ToolResult
    expect(result.count).toBe(2)
    expect(result.nodes?.every((n) => n.type === 'FRAME')).toBe(true)
  })

  test('finds by attribute //RECTANGLE[@width < 200]', async () => {
    const { figma } = setupToolTest()
    const small = figma.createRectangle()
    small.resize(100, 50)
    small.name = 'Small'
    const big = figma.createRectangle()
    big.resize(400, 400)
    big.name = 'Big'

    const tool = getTool('query_nodes')
    const result = (await tool.execute(figma, {
      selector: '//RECTANGLE[@width < 200]'
    })) as ToolResult
    expect(result.count).toBe(1)
    expect(result.nodes[0].name).toBe('Small')
  })

  test('finds by name with contains', async () => {
    const { figma } = setupToolTest()
    const t1 = figma.createText()
    t1.name = 'Label Primary'
    const t2 = figma.createText()
    t2.name = 'Title'
    const t3 = figma.createText()
    t3.name = 'Label Secondary'

    const tool = getTool('query_nodes')
    const result = (await tool.execute(figma, {
      selector: '//TEXT[contains(@name, "Label")]'
    })) as ToolResult
    expect(result.count).toBe(2)
    expect(result.nodes?.every((n) => n.name.includes('Label'))).toBe(true)
  })

  test('returns error for invalid xpath', async () => {
    const { figma } = setupToolTest()
    const tool = getTool('query_nodes')
    const result = (await tool.execute(figma, { selector: '///invalid[[[[' })) as ToolResult
    expect(result.error).toBeTruthy()
    expect(result.error).toContain('XPath error')
  })

  test('respects limit param', async () => {
    const { figma } = setupToolTest()
    for (let i = 0; i < 10; i++) {
      const r = figma.createRectangle()
      r.name = `Rect ${i}`
    }

    const tool = getTool('query_nodes')
    const result = (await tool.execute(figma, { selector: '//RECTANGLE', limit: 3 })) as ToolResult
    expect(result.count).toBe(3)
  })

  test('returns empty array when nothing matches', async () => {
    const { figma } = setupToolTest()
    figma.createRectangle()

    const tool = getTool('query_nodes')
    const result = (await tool.execute(figma, { selector: '//ELLIPSE' })) as ToolResult
    expect(result.count).toBe(0)
    expect(result.nodes).toEqual([])
  })
})

describe('get_node', () => {
  test('returns node details', () => {
    const { figma } = setupToolTest()
    const rect = figma.createRectangle()
    rect.name = 'Test Rect'
    rect.resize(100, 50)

    const tool = getTool('get_node')
    const result = tool.execute(figma, { id: rect.id }) as ToolResult
    expect(result.name).toBe('Test Rect')
    expect(result.width).toBe(100)
    expect(result.height).toBe(50)
  })
})

describe('page tools', () => {
  test('list_pages returns pages', () => {
    const { figma } = setupToolTest()
    const tool = getTool('list_pages')
    const result = tool.execute(figma, {}) as ToolResult
    expect(result.pages.length).toBeGreaterThanOrEqual(1)
  })

  test('switch_page changes page', () => {
    const { figma } = setupToolTest()
    const page2 = figma.createPage()
    page2.name = 'Page 2'

    const tool = getTool('switch_page')
    tool.execute(figma, { page: 'Page 2' })

    expect(figma.currentPage.name).toBe('Page 2')
  })

  test('switch_page persists across separate FigmaAPI instances (RPC simulation)', () => {
    const { graph } = setupToolTest()
    const switchPage = getTool('switch_page')
    const getCurrentPage = getTool('get_current_page')
    const createPage = getTool('create_page')

    let currentPageId = graph.getPages()[0].id

    function rpcCall(tool: (typeof ALL_TOOLS)[number], args: Record<string, unknown>) {
      const figma = new FigmaAPI(graph)
      figma.currentPage = figma.wrapNode(currentPageId)
      const result = tool.execute(figma, args)
      if (figma.currentPageId !== currentPageId) {
        currentPageId = figma.currentPageId
      }
      return result
    }

    rpcCall(createPage, { name: 'Second' })
    rpcCall(switchPage, { page: 'Second' })
    const result = rpcCall(getCurrentPage, {}) as { id: string; name: string }

    expect(result.name).toBe('Second')
  })
})

describe('eval', () => {
  test('executes code with figma api', async () => {
    const { figma } = setupToolTest()
    const tool = getTool('eval')
    const result = await tool.execute(figma, {
      code: 'const r = figma.createRectangle(); r.name = "FromEval"; return r.name;'
    })
    expect(result).toBe('FromEval')
  })
})
