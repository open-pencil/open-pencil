import { describe, expect, test } from 'bun:test'

import { ALL_TOOLS, FigmaAPI, SceneGraph, computeAllLayouts, parseFigFile } from '@open-pencil/core'

describe('MCP tool execution', () => {
  function setup() {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    return { graph, api }
  }

  function setupWithFile(data: ArrayBuffer) {
    return parseFigFile(data).then((graph) => {
      computeAllLayouts(graph)
      const api = new FigmaAPI(graph)
      return { graph, api }
    })
  }

  function findTool(name: string) {
    const tool = ALL_TOOLS.find((t) => t.name === name)
    if (!tool) throw new Error(`Tool "${name}" not found`)
    return tool
  }

  test('all tools have name, description, and execute', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.name).toBeString()
      expect(tool.description).toBeString()
      expect(tool.execute).toBeFunction()
    }
  })

  test('tool names are unique', () => {
    const names = ALL_TOOLS.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })

  test('get_page_tree returns page hierarchy', () => {
    const { api } = setup()
    const result = findTool('get_page_tree').execute(api, {}) as {
      page: string
      children: unknown[]
    }
    expect(result.page).toBe('Page 1')
    expect(result.children).toBeArray()
  })

  test('create_shape creates a frame', () => {
    const { api } = setup()
    const result = findTool('create_shape').execute(api, {
      type: 'FRAME',
      x: 10,
      y: 20,
      width: 300,
      height: 200,
      name: 'TestFrame'
    }) as { id: string; name: string; type: string }
    expect(result.type).toBe('FRAME')
    expect(result.name).toBe('TestFrame')

    const node = api.getNodeById(result.id)
    expect(node).not.toBeNull()
    expect(node!.x).toBe(10)
    expect(node!.y).toBe(20)
    expect(node!.width).toBe(300)
    expect(node!.height).toBe(200)
  })

  test('set_fill applies color', () => {
    const { api } = setup()
    const frame = findTool('create_shape').execute(api, {
      type: 'RECTANGLE',
      x: 0,
      y: 0,
      width: 100,
      height: 100
    }) as { id: string }

    findTool('set_fill').execute(api, { id: frame.id, color: '#ff0000' })
    const node = api.getNodeById(frame.id)!
    expect(node.fills).toHaveLength(1)
    expect(node.fills[0].color.r).toBeCloseTo(1)
    expect(node.fills[0].color.g).toBeCloseTo(0)
    expect(node.fills[0].color.b).toBeCloseTo(0)
  })

  test('set_layout configures auto-layout', () => {
    const { api } = setup()
    const frame = findTool('create_shape').execute(api, {
      type: 'FRAME',
      x: 0,
      y: 0,
      width: 400,
      height: 300
    }) as { id: string }

    findTool('set_layout').execute(api, {
      id: frame.id,
      direction: 'VERTICAL',
      spacing: 16,
      padding: 24
    })

    const node = api.getNodeById(frame.id)!
    expect(node.layoutMode).toBe('VERTICAL')
    expect(node.itemSpacing).toBe(16)
    expect(node.paddingTop).toBe(24)
    expect(node.paddingLeft).toBe(24)
  })

  test('create_shape with parent_id nests correctly', () => {
    const { api } = setup()
    const parent = findTool('create_shape').execute(api, {
      type: 'FRAME',
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      name: 'Parent'
    }) as { id: string }

    const child = findTool('create_shape').execute(api, {
      type: 'TEXT',
      x: 0,
      y: 0,
      width: 200,
      height: 30,
      name: 'Child',
      parent_id: parent.id
    }) as { id: string }

    const tree = findTool('get_page_tree').execute(api, {}) as {
      children: { id: string; children?: unknown[] }[]
    }
    const parentNode = tree.children.find((c: { id: string }) => c.id === parent.id)
    expect(parentNode).toBeDefined()
    expect(parentNode!.children).toBeArray()
  })

  test('delete_node removes node', () => {
    const { api } = setup()
    const frame = findTool('create_shape').execute(api, {
      type: 'RECTANGLE',
      x: 0,
      y: 0,
      width: 100,
      height: 100
    }) as { id: string }

    findTool('delete_node').execute(api, { id: frame.id })
    expect(api.getNodeById(frame.id)).toBeNull()
  })

  test('find_nodes filters by type', () => {
    const { api } = setup()
    findTool('create_shape').execute(api, {
      type: 'FRAME',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      name: 'F1'
    })
    findTool('create_shape').execute(api, {
      type: 'RECTANGLE',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      name: 'R1'
    })
    findTool('create_shape').execute(api, {
      type: 'FRAME',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      name: 'F2'
    })

    const result = findTool('find_nodes').execute(api, { type: 'FRAME' }) as { count: number }
    expect(result.count).toBe(2)
  })

  test('clone_node duplicates a node', () => {
    const { api } = setup()
    const frame = findTool('create_shape').execute(api, {
      type: 'RECTANGLE',
      x: 10,
      y: 20,
      width: 100,
      height: 50
    }) as { id: string }

    const clone = findTool('clone_node').execute(api, { id: frame.id }) as { id: string }
    expect(clone.id).not.toBe(frame.id)
    const clonedNode = api.getNodeById(clone.id)!
    expect(clonedNode.width).toBe(100)
    expect(clonedNode.height).toBe(50)
  })

  test('update_node modifies properties', () => {
    const { api } = setup()
    const frame = findTool('create_shape').execute(api, {
      type: 'RECTANGLE',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      name: 'Before'
    }) as { id: string }

    const result = findTool('update_node').execute(api, {
      id: frame.id,
      x: 50,
      opacity: 0.5,
      corner_radius: 8,
      name: 'After'
    }) as { updated: string[] }

    expect(result.updated).toContain('x')
    expect(result.updated).toContain('opacity')
    expect(result.updated).toContain('cornerRadius')
    expect(result.updated).toContain('name')

    const node = api.getNodeById(frame.id)!
    expect(node.x).toBe(50)
    expect(node.opacity).toBe(0.5)
    expect(node.cornerRadius).toBe(8)
    expect(node.name).toBe('After')
  })

  test('list_pages returns all pages', () => {
    const { api } = setup()
    const result = findTool('list_pages').execute(api, {}) as { pages: { name: string }[] }
    expect(result.pages.length).toBeGreaterThanOrEqual(1)
    expect(result.pages[0].name).toBe('Page 1')
  })

  test('error on missing node', () => {
    const { api } = setup()
    const result = findTool('get_node').execute(api, { id: 'nonexistent' }) as { error: string }
    expect(result.error).toContain('not found')
  })

  test('open and query .fig file', async () => {
    const data = await Bun.file('tests/fixtures/gold-preview.fig').arrayBuffer()
    const { api } = await setupWithFile(data)
    const pages = findTool('list_pages').execute(api, {}) as { pages: { name: string }[] }
    expect(pages.pages.length).toBeGreaterThanOrEqual(1)

    const found = findTool('find_nodes').execute(api, { type: 'INSTANCE' }) as { count: number }
    expect(found.count).toBeGreaterThan(0)
  })
})
