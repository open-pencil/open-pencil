import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core'

import { getTool, setupToolTest, type ALL_TOOLS, type ToolResult } from '#tests/helpers/tools'

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

  test('paginates results and returns hierarchy context', () => {
    const { figma } = setupToolTest()
    const frame = figma.createFrame()
    frame.name = 'Checkout'
    for (let index = 0; index < 4; index++) {
      const child = figma.createRectangle()
      child.name = `Card ${index}`
      frame.appendChild(child)
    }

    const tool = getTool('find_nodes')
    const first = tool.execute(figma, { type: 'RECTANGLE', depth: 2, limit: 2 }) as ToolResult
    expect(first.total).toBe(4)
    expect(first.returned).toBe(2)
    expect(first.has_more).toBe(true)
    expect(first.next_offset).toBe(2)
    expect(first.nodes[0]).toMatchObject({
      parent_id: frame.id,
      depth: 2,
      path: [figma.currentPage.name, 'Checkout', 'Card 0']
    })

    const second = tool.execute(figma, {
      type: 'RECTANGLE',
      depth: 2,
      limit: 2,
      offset: 2
    }) as ToolResult
    expect(second.nodes.map((node) => node.name)).toEqual(['Card 2', 'Card 3'])
    expect(second.has_more).toBe(false)
  })

  test('scopes searches by page, root, and depth', () => {
    const { figma } = setupToolTest()
    const currentFrame = figma.createFrame()
    currentFrame.name = 'Current flow'
    const nestedFrame = figma.createFrame()
    nestedFrame.name = 'Nested flow'
    currentFrame.appendChild(nestedFrame)

    const otherPage = figma.createPage()
    otherPage.name = 'Other page'
    figma.currentPage = otherPage
    const otherFrame = figma.createFrame()
    otherFrame.name = 'Other flow'

    const tool = getTool('find_nodes')
    const topLevel = tool.execute(figma, {
      page: 'Page 1',
      type: 'FRAME',
      depth: 1
    }) as ToolResult
    expect(topLevel.nodes.map((node) => node.name)).toEqual(['Current flow'])
    expect(topLevel.page).toMatchObject({ name: 'Page 1', current: false })

    const rooted = tool.execute(figma, {
      page: 'Page 1',
      root_id: currentFrame.id,
      type: 'FRAME',
      depth: 1
    }) as ToolResult
    expect(rooted.nodes.map((node) => node.name)).toEqual(['Nested flow'])
  })

  test('defaults to direct children and reports expandable child counts', () => {
    const { figma } = setupToolTest()
    const frame = figma.createFrame()
    frame.name = 'Screen'
    const nested = figma.createFrame()
    nested.name = 'Content'
    frame.appendChild(nested)
    const text = figma.createText()
    text.name = 'Title'
    nested.appendChild(text)

    const tool = getTool('find_nodes')
    const topLevel = tool.execute(figma, {}) as ToolResult
    expect(topLevel.depth).toBe(1)
    expect(topLevel.nodes).toHaveLength(1)
    expect(topLevel.nodes[0]).toMatchObject({ name: 'Screen', child_count: 1 })

    const children = tool.execute(figma, { root_id: frame.id }) as ToolResult
    expect(children.nodes).toHaveLength(1)
    expect(children.nodes[0]).toMatchObject({ name: 'Content', child_count: 1, depth: 1 })
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

describe('get_font_status', () => {
  test('returns font fidelity diagnostics for agents', () => {
    const { figma } = setupToolTest()
    const text = figma.createText()
    text.name = 'Missing label'
    text.fontName = { family: 'Unavailable Sans', style: 'Regular' }

    const tool = getTool('get_font_status')
    const result = tool.execute(figma, {}) as {
      faithful: boolean
      issues: Array<{
        family: string
        style: string
        status: string
        nodeIds: string[]
      }>
    }

    expect(result.faithful).toBe(false)
    expect(result.issues).toEqual([
      expect.objectContaining({
        family: 'Unavailable Sans',
        style: 'Regular',
        status: 'unresolved',
        nodeIds: [text.id]
      })
    ])
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

describe('get_page_tree', () => {
  test('lists only root frames when depth and node type are constrained', () => {
    const { figma } = setupToolTest()
    const rootFrame = figma.createFrame()
    rootFrame.name = 'Root frame'
    const nestedFrame = figma.createFrame()
    nestedFrame.name = 'Nested frame'
    rootFrame.appendChild(nestedFrame)
    figma.createRectangle().name = 'Root rectangle'

    const tool = getTool('get_page_tree')
    const result = tool.execute(figma, {
      depth: 1,
      node_types: ['FRAME']
    }) as ToolResult

    expect(result.children).toEqual([
      {
        id: rootFrame.id,
        type: 'FRAME',
        name: 'Root frame',
        w: rootFrame.width,
        h: rootFrame.height
      }
    ])
  })
})

describe('page tools', () => {
  test('list_pages returns pages', () => {
    const { figma } = setupToolTest()
    const tool = getTool('list_pages')
    const result = tool.execute(figma, {}) as ToolResult
    expect(result.pages.length).toBeGreaterThanOrEqual(1)
    expect(result.current).toEqual({ id: figma.currentPage.id, name: figma.currentPage.name })
  })

  test('switch_page changes page', () => {
    const { figma } = setupToolTest()
    const page2 = figma.createPage()
    page2.name = 'Page 2'

    const tool = getTool('switch_page')
    tool.execute(figma, { page: 'Page 2' })

    expect(figma.currentPage.name).toBe('Page 2')
  })

  test('switch_page rejects IDs that do not belong to pages', () => {
    const { figma } = setupToolTest()
    const rectangle = figma.createRectangle()
    const originalPageId = figma.currentPage.id

    const tool = getTool('switch_page')
    const result = tool.execute(figma, { page: rectangle.id }) as ToolResult

    expect(result.error).toContain('not found')
    expect(figma.currentPage.id).toBe(originalPageId)
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
