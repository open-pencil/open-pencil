import { beforeAll, describe, expect, test } from 'bun:test'

import { DEFAULT_FONT_FAMILY } from '@open-pencil/core/constants'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { fontManager } from '@open-pencil/core/text'
import { expectDefined } from '@open-pencil/test-support/assert'

import { registerTestFont } from '@open-pencil/test-support/fonts/bundled'
import { getTool, setupToolTest, type ALL_TOOLS, type ToolResult } from '#core-tests/helpers/tools'
beforeAll(() => registerTestFont())

/** The `list_pages` tool answers with the document's pages. */
interface ListPagesResult extends ToolResult {
  pages: Array<{ id: string; name: string }>
}

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
    expect(expectDefined(result.nodes, 'found nodes')[0].name).toBe('Button Primary')
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
    expect(expectDefined(result.nodes, 'queried nodes')[0].name).toBe('Small')
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

  test('returns the text of visible TEXT nodes inside a frame in layer order', async () => {
    const { figma } = setupToolTest()
    const card = figma.createFrame()
    const title = figma.createText()
    title.characters = 'Balance'
    const hiddenGroup = figma.createFrame()
    hiddenGroup.visible = false
    const hiddenText = figma.createText()
    hiddenText.characters = 'Draft'
    hiddenGroup.appendChild(hiddenText)
    const amount = figma.createText()
    amount.characters = '$12,450\nAvailable'
    card.appendChild(title)
    card.appendChild(hiddenGroup)
    card.appendChild(amount)
    figma.createText().characters = 'Outside'

    const tool = getTool('query_nodes')
    const result = (await tool.execute(figma, {
      selector: `//*[@id='${card.id}']//TEXT[not(ancestor-or-self::*[@visible='false'])]`
    })) as ToolResult
    expect(result.nodes?.map((node) => [node.id, node.text])).toEqual([
      [title.id, 'Balance'],
      [amount.id, '$12,450\nAvailable']
    ])
  })

  test('omits text for non-text nodes', async () => {
    const { figma } = setupToolTest()
    figma.createRectangle()

    const tool = getTool('query_nodes')
    const result = (await tool.execute(figma, { selector: '//RECTANGLE' })) as ToolResult
    expect(expectDefined(result.nodes, 'queried nodes')[0]).not.toHaveProperty('text')
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
    const { figma, graph } = setupToolTest()
    const text = figma.createText()
    text.name = 'Missing label'
    // A document can name a font this machine lacks; a script cannot set one it did not load.
    graph.updateNode(text.id, { fontFamily: 'Unavailable Sans' })

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

    // The tool reads the process-wide font manager. A missing family is
    // 'unresolved' in a pristine process and 'substituted' by the default font
    // once any earlier suite in the shard has loaded it; both are issues.
    const defaultLoaded = fontManager.loadedFontSource(DEFAULT_FONT_FAMILY, 'Regular') !== null

    expect(result.faithful).toBe(false)
    expect(result.issues).toEqual([
      expect.objectContaining({
        family: 'Unavailable Sans',
        style: 'Regular',
        status: defaultLoaded ? 'substituted' : 'unresolved',
        substituteFamily: defaultLoaded ? DEFAULT_FONT_FAMILY : null,
        nodeIds: [text.id]
      })
    ])
  })
})

describe('get_node', () => {
  test('returns node details', async () => {
    const { figma } = setupToolTest()
    const rect = figma.createRectangle()
    rect.name = 'Test Rect'
    rect.resize(100, 50)

    const tool = getTool('get_node')
    const result = (await tool.execute(figma, { id: rect.id })) as ToolResult
    expect(result.name).toBe('Test Rect')
    expect(result.width).toBe(100)
    expect(result.height).toBe(50)
  })
})

describe('get_page_tree', () => {
  test('includes the text of TEXT nodes', async () => {
    const { figma } = setupToolTest()
    const card = figma.createFrame()
    const label = figma.createText()
    label.characters = 'Saldo disponível'
    card.appendChild(label)

    const tool = getTool('get_page_tree')
    const result = await tool.execute(figma, { root_id: card.id, node_types: ['TEXT'] })
    expect(result).toMatchObject({
      root: card.id,
      tree: { id: card.id, children: [{ id: label.id, text: 'Saldo disponível' }] }
    })
    expect(result).not.toHaveProperty('tree.text')
  })
})

describe('pages not yet visited', () => {
  /** A document whose second page has no layers until the host loads it, as the editor's do. */
  function lazyDocument() {
    const { graph } = setupToolTest()
    const later = graph.addPage('Later')
    const loads: string[] = []
    const figma = new FigmaAPI(graph, {
      loadPage: async (id) => {
        loads.push(id)
        if (id === later.id && graph.getChildren(id).length === 0)
          graph.createNode('COMPONENT', id, { name: 'Loaded button' })
      }
    })
    return { figma, later, loads }
  }

  test('load before a tool reads them', async () => {
    const tree = lazyDocument()
    expect(
      await getTool('get_page_tree').execute(tree.figma, { root_id: tree.later.id })
    ).toMatchObject({ tree: { children: [{ name: 'Loaded button' }] } })
    const query = lazyDocument()
    expect(
      await getTool('query_nodes').execute(query.figma, { selector: '//COMPONENT', page: 'Later' })
    ).toMatchObject({ count: 1 })
    const components = lazyDocument()
    expect(await getTool('get_components').execute(components.figma, {})).toMatchObject({
      components: [{ name: 'Loaded button', page: 'Later' }]
    })
  })

  test('switch to the page asked for last, whichever loads last', async () => {
    const { graph } = setupToolTest()
    const [first] = graph.getPages()
    const slow = graph.addPage('Slow')
    const fast = graph.addPage('Fast')
    const slowLoad = Promise.withResolvers<undefined>()
    const figma = new FigmaAPI(graph, {
      loadPage: async (id) => {
        if (id === slow.id) await slowLoad.promise
      }
    })
    const slowSwitch = figma.setCurrentPageAsync(figma.wrapNode(slow.id))
    await figma.setCurrentPageAsync(figma.wrapNode(fast.id))
    slowLoad.resolve(undefined)
    await slowSwitch
    expect(figma.currentPage.id).toBe(fast.id)

    // A page set directly counts as asked for last too.
    const pending = Promise.withResolvers<undefined>()
    const later = new FigmaAPI(graph, { loadPage: () => pending.promise })
    const switching = later.setCurrentPageAsync(later.wrapNode(slow.id))
    later.currentPage = later.wrapNode(first.id)
    pending.resolve(undefined)
    await switching
    expect(later.currentPage.id).toBe(first.id)
  })

  test('refuse to switch to a page removed while it loaded', async () => {
    const { graph } = setupToolTest()
    const doomed = graph.addPage('Doomed')
    const figma = new FigmaAPI(graph, {
      loadPage: async () => {
        graph.deleteNode(doomed.id)
      }
    })
    await expect(figma.setCurrentPageAsync(figma.wrapNode(doomed.id))).rejects.toThrow(
      'removed while it loaded'
    )

    const later = graph.addPage('Later')
    const removing = new FigmaAPI(graph, {
      loadPage: async () => {
        await Promise.resolve()
        graph.deleteNode(later.id)
      }
    })
    await expect(removing.setCurrentPageAsync(removing.wrapNode(later.id))).rejects.toThrow(
      'removed while it loaded'
    )
  })

  test('load when a script or a tool switches to them', async () => {
    const { figma, later, loads } = lazyDocument()
    await getTool('switch_page').execute(figma, { page: 'Later' })
    expect(figma.currentPage.children.map((node) => node.name)).toEqual(['Loaded button'])
    await figma.loadAllPagesAsync()
    expect(loads).toContain(later.id)
  })
})

describe('page tools', () => {
  test('list_pages returns pages', () => {
    const { figma } = setupToolTest()
    const tool = getTool('list_pages')
    const result = tool.execute(figma, {}) as ListPagesResult
    expect(result.pages.length).toBeGreaterThanOrEqual(1)
  })

  test('switch_page changes page', async () => {
    const { figma } = setupToolTest()
    const page2 = figma.createPage()
    page2.name = 'Page 2'

    const tool = getTool('switch_page')
    await tool.execute(figma, { page: 'Page 2' })

    expect(figma.currentPage.name).toBe('Page 2')
  })

  test('switch_page persists across separate FigmaAPI instances (RPC simulation)', async () => {
    const { graph } = setupToolTest()
    const switchPage = getTool('switch_page')
    const getCurrentPage = getTool('get_current_page')
    const createPage = getTool('create_page')

    let currentPageId = graph.getPages()[0].id

    async function rpcCall(tool: (typeof ALL_TOOLS)[number], args: Record<string, unknown>) {
      const figma = new FigmaAPI(graph)
      figma.currentPage = figma.wrapNode(currentPageId)
      const result = await tool.execute(figma, args)
      if (figma.currentPageId !== currentPageId) {
        currentPageId = figma.currentPageId
      }
      return result
    }

    await rpcCall(createPage, { name: 'Second' })
    await rpcCall(switchPage, { page: 'Second' })
    const result = (await rpcCall(getCurrentPage, {})) as { id: string; name: string }

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

describe('get_selection', () => {
  /** A card selected on the page, holding a row that holds a chip. */
  function selectedCard() {
    const { figma } = setupToolTest()
    const card = figma.createFrame()
    card.name = 'Card'
    const row = figma.createFrame()
    row.name = 'Row'
    card.appendChild(row)
    const chip = figma.createRectangle()
    chip.name = 'Chip'
    row.appendChild(chip)
    figma.currentPage.selection = [card]
    return figma
  }

  test('returns the selection with its direct children by default', () => {
    const result = getTool('get_selection').execute(selectedCard(), {}) as {
      selection: Array<{ name: string; children?: Array<{ name: string; childCount?: number }> }>
    }
    const [card] = result.selection
    expect(card.name).toBe('Card')
    expect(card.children?.map((child) => child.name)).toEqual(['Row'])
    expect(card.children?.[0].childCount).toBe(1)
  })

  test('takes a depth', () => {
    const tool = getTool('get_selection')
    const shallow = tool.execute(selectedCard(), { depth: 0 }) as {
      selection: Array<{ children?: unknown; childCount?: number }>
    }
    expect(shallow.selection[0].children).toBeUndefined()
    expect(shallow.selection[0].childCount).toBe(1)

    const deep = tool.execute(selectedCard(), { depth: 2 }) as {
      selection: Array<{ children: Array<{ children: Array<{ name: string }> }> }>
    }
    expect(deep.selection[0].children[0].children[0].name).toBe('Chip')
  })
})
