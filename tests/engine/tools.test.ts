import { describe, expect, test } from 'bun:test'

import { ALL_TOOLS, FigmaAPI, SceneGraph, computeAllLayouts } from '@open-pencil/core'

function setup() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  return { graph, figma }
}

describe('tool definitions', () => {
  test('all tools have unique names', () => {
    const names = ALL_TOOLS.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })

  test('all tools have description and params', () => {
    for (const t of ALL_TOOLS) {
      expect(t.name).toBeTruthy()
      expect(t.description).toBeTruthy()
      expect(typeof t.params).toBe('object')
      expect(typeof t.execute).toBe('function')
    }
  })

  test('required params are marked', () => {
    for (const t of ALL_TOOLS) {
      for (const [key, param] of Object.entries(t.params)) {
        expect(typeof param.type).toBe('string')
        expect(typeof param.description).toBe('string')
      }
    }
  })
})

describe('create_shape', () => {
  test('creates a frame', () => {
    const { figma } = setup()
    const tool = ALL_TOOLS.find((t) => t.name === 'create_shape')!
    const result = tool.execute(figma, {
      type: 'FRAME',
      x: 100,
      y: 200,
      width: 300,
      height: 400,
      name: 'Test Frame'
    }) as any
    expect(result.name).toBe('Test Frame')
    expect(result.type).toBe('FRAME')

    const node = figma.getNodeById(result.id)!
    expect(node.x).toBe(100)
    expect(node.y).toBe(200)
    expect(node.width).toBe(300)
    expect(node.height).toBe(400)
  })

  test('creates nested inside parent', () => {
    const { figma } = setup()
    const tool = ALL_TOOLS.find((t) => t.name === 'create_shape')!
    const parent = tool.execute(figma, {
      type: 'FRAME',
      x: 0,
      y: 0,
      width: 500,
      height: 500,
      name: 'Parent'
    }) as any
    const child = tool.execute(figma, {
      type: 'RECTANGLE',
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      parent_id: parent.id
    }) as any

    const parentNode = figma.getNodeById(parent.id)!
    expect(parentNode.children.some((c) => c.id === child.id)).toBe(true)
  })
})

describe('set_fill', () => {
  test('sets solid fill', () => {
    const { figma } = setup()
    const frame = figma.createFrame()
    frame.resize(100, 100)

    const tool = ALL_TOOLS.find((t) => t.name === 'set_fill')!
    tool.execute(figma, { id: frame.id, color: '#ff0000' })

    const fills = figma.getNodeById(frame.id)!.fills
    expect(fills.length).toBe(1)
    expect(fills[0].color.r).toBeCloseTo(1)
    expect(fills[0].color.g).toBeCloseTo(0)
    expect(fills[0].color.b).toBeCloseTo(0)
  })

  test('returns error for missing node', () => {
    const { figma } = setup()
    const tool = ALL_TOOLS.find((t) => t.name === 'set_fill')!
    const result = tool.execute(figma, { id: 'nonexistent', color: '#ff0000' }) as any
    expect(result.error).toContain('not found')
  })
})

describe('set_stroke', () => {
  test('sets stroke', () => {
    const { figma } = setup()
    const rect = figma.createRectangle()
    rect.resize(100, 100)

    const tool = ALL_TOOLS.find((t) => t.name === 'set_stroke')!
    tool.execute(figma, { id: rect.id, color: '#0000ff', weight: 2 })

    const strokes = figma.getNodeById(rect.id)!.strokes
    expect(strokes.length).toBe(1)
    expect(strokes[0].color.b).toBeCloseTo(1)
    expect(strokes[0].weight).toBe(2)
  })
})

describe('set_effects', () => {
  test('adds drop shadow', () => {
    const { figma } = setup()
    const frame = figma.createFrame()
    frame.resize(100, 100)

    const tool = ALL_TOOLS.find((t) => t.name === 'set_effects')!
    tool.execute(figma, {
      id: frame.id,
      type: 'DROP_SHADOW',
      color: '#000000',
      offset_x: 0,
      offset_y: 4,
      radius: 8,
      spread: 0
    })

    const effects = figma.getNodeById(frame.id)!.effects
    expect(effects.length).toBe(1)
    expect(effects[0].type).toBe('DROP_SHADOW')
  })

  test('adds blur without color', () => {
    const { figma } = setup()
    const frame = figma.createFrame()
    frame.resize(100, 100)

    const tool = ALL_TOOLS.find((t) => t.name === 'set_effects')!
    tool.execute(figma, { id: frame.id, type: 'BACKGROUND_BLUR', radius: 10 })

    const effects = figma.getNodeById(frame.id)!.effects
    expect(effects.length).toBe(1)
    expect(effects[0].type).toBe('BACKGROUND_BLUR')
  })
})

describe('update_node', () => {
  test('updates position and size', () => {
    const { figma } = setup()
    const rect = figma.createRectangle()
    rect.resize(100, 100)

    const tool = ALL_TOOLS.find((t) => t.name === 'update_node')!
    const result = tool.execute(figma, {
      id: rect.id,
      x: 50,
      y: 75,
      width: 200,
      height: 150,
      opacity: 0.5
    }) as any

    expect(result.updated).toContain('x')
    expect(result.updated).toContain('size')
    expect(result.updated).toContain('opacity')

    const node = figma.getNodeById(rect.id)!
    expect(node.x).toBe(50)
    expect(node.y).toBe(75)
    expect(node.width).toBe(200)
    expect(node.height).toBe(150)
    expect(node.opacity).toBe(0.5)
  })

  test('updates corner radius', () => {
    const { figma } = setup()
    const rect = figma.createRectangle()
    rect.resize(100, 100)

    const tool = ALL_TOOLS.find((t) => t.name === 'update_node')!
    tool.execute(figma, { id: rect.id, corner_radius: 12 })

    expect(figma.getNodeById(rect.id)!.cornerRadius).toBe(12)
  })
})

describe('set_layout', () => {
  test('sets auto-layout', () => {
    const { figma } = setup()
    const frame = figma.createFrame()
    frame.resize(300, 200)

    const tool = ALL_TOOLS.find((t) => t.name === 'set_layout')!
    tool.execute(figma, {
      id: frame.id,
      direction: 'VERTICAL',
      spacing: 16,
      padding: 20
    })

    const node = figma.getNodeById(frame.id)!
    expect(node.layoutMode).toBe('VERTICAL')
    expect(node.itemSpacing).toBe(16)
    expect(node.paddingLeft).toBe(20)
    expect(node.paddingTop).toBe(20)
  })

  test('defaults to HUG sizing when enabling auto-layout', () => {
    const { graph, figma } = setup()
    const frame = figma.createFrame()
    frame.resize(300, 200)

    const rawBefore = graph.getNode(frame.id)!
    expect(rawBefore.layoutMode).toBe('NONE')
    expect(rawBefore.primaryAxisSizing).toBe('FIXED')
    expect(rawBefore.counterAxisSizing).toBe('FIXED')

    const tool = ALL_TOOLS.find((t) => t.name === 'set_layout')!
    tool.execute(figma, { id: frame.id, direction: 'VERTICAL' })

    const rawAfter = graph.getNode(frame.id)!
    expect(rawAfter.layoutMode).toBe('VERTICAL')
    expect(rawAfter.primaryAxisSizing).toBe('HUG')
    expect(rawAfter.counterAxisSizing).toBe('HUG')
  })

  test('preserves sizing modes when updating existing auto-layout', () => {
    const { graph, figma } = setup()
    const frame = figma.createFrame()
    frame.resize(300, 200)

    const tool = ALL_TOOLS.find((t) => t.name === 'set_layout')!
    tool.execute(figma, { id: frame.id, direction: 'HORIZONTAL' })

    // Manually set primary axis back to FIXED (user wants fixed width)
    graph.updateNode(frame.id, { primaryAxisSizing: 'FIXED' })
    expect(graph.getNode(frame.id)!.primaryAxisSizing).toBe('FIXED')

    // Updating spacing should NOT reset sizing modes
    tool.execute(figma, { id: frame.id, spacing: 24 })

    const raw = graph.getNode(frame.id)!
    expect(raw.primaryAxisSizing).toBe('FIXED')
    expect(raw.counterAxisSizing).toBe('HUG')
  })

  test('HUG default enables hug-to-fit with 5 children', () => {
    const { graph, figma } = setup()
    const frame = figma.createFrame()
    frame.resize(320, 100)

    const tool = ALL_TOOLS.find((t) => t.name === 'set_layout')!
    tool.execute(figma, { id: frame.id, direction: 'VERTICAL', spacing: 8, padding: 16 })

    for (let i = 0; i < 5; i++) {
      const child = figma.createRectangle()
      child.resize(280, 50)
      frame.appendChild(child)
    }

    computeAllLayouts(graph)

    const node = graph.getNode(frame.id)!
    expect(node.primaryAxisSizing).toBe('HUG')
    // 16 (top pad) + 5*50 (children) + 4*8 (gaps) + 16 (bottom pad) = 314
    expect(node.height).toBe(314)
  })
})

describe('delete_node', () => {
  test('removes a node', () => {
    const { figma } = setup()
    const rect = figma.createRectangle()

    const tool = ALL_TOOLS.find((t) => t.name === 'delete_node')!
    tool.execute(figma, { id: rect.id })

    expect(figma.getNodeById(rect.id)).toBeNull()
  })
})

describe('clone_node', () => {
  test('duplicates a node', () => {
    const { figma } = setup()
    const rect = figma.createRectangle()
    rect.name = 'Original'
    rect.resize(100, 100)

    const tool = ALL_TOOLS.find((t) => t.name === 'clone_node')!
    const result = tool.execute(figma, { id: rect.id }) as any

    expect(result.id).not.toBe(rect.id)
    expect(result.name).toBe('Original')
  })
})

describe('rename_node', () => {
  test('renames a node', () => {
    const { figma } = setup()
    const rect = figma.createRectangle()

    const tool = ALL_TOOLS.find((t) => t.name === 'rename_node')!
    tool.execute(figma, { id: rect.id, name: 'My Rectangle' })

    expect(figma.getNodeById(rect.id)!.name).toBe('My Rectangle')
  })
})

describe('reparent_node', () => {
  test('moves node into frame', () => {
    const { figma } = setup()
    const frame = figma.createFrame()
    frame.resize(300, 300)
    const rect = figma.createRectangle()
    rect.resize(50, 50)

    const tool = ALL_TOOLS.find((t) => t.name === 'reparent_node')!
    tool.execute(figma, { id: rect.id, parent_id: frame.id })

    expect(figma.getNodeById(frame.id)!.children.some((c) => c.id === rect.id)).toBe(true)
  })
})

describe('group_nodes', () => {
  test('groups two nodes', () => {
    const { figma } = setup()
    const r1 = figma.createRectangle()
    r1.resize(50, 50)
    const r2 = figma.createRectangle()
    r2.resize(50, 50)

    const tool = ALL_TOOLS.find((t) => t.name === 'group_nodes')!
    const result = tool.execute(figma, { ids: [r1.id, r2.id] }) as any

    expect(result.type).toBe('GROUP')
    const group = figma.getNodeById(result.id)!
    expect(group.children.length).toBe(2)
  })
})

describe('find_nodes', () => {
  test('finds by name', () => {
    const { figma } = setup()
    const rect = figma.createRectangle()
    rect.name = 'Button Primary'
    const text = figma.createText()
    text.name = 'Label'

    const tool = ALL_TOOLS.find((t) => t.name === 'find_nodes')!
    const result = tool.execute(figma, { name: 'button' }) as any
    expect(result.count).toBe(1)
    expect(result.nodes[0].name).toBe('Button Primary')
  })

  test('finds by type', () => {
    const { figma } = setup()
    figma.createRectangle()
    figma.createRectangle()
    figma.createText()

    const tool = ALL_TOOLS.find((t) => t.name === 'find_nodes')!
    const result = tool.execute(figma, { type: 'RECTANGLE' }) as any
    expect(result.count).toBe(2)
  })
})

describe('query_nodes', () => {
  test('finds all frames with //FRAME', async () => {
    const { figma } = setup()
    const f1 = figma.createFrame()
    f1.resize(200, 200)
    f1.name = 'Frame A'
    const f2 = figma.createFrame()
    f2.resize(300, 300)
    f2.name = 'Frame B'
    figma.createRectangle()

    const tool = ALL_TOOLS.find((t) => t.name === 'query_nodes')!
    const result = await tool.execute(figma, { selector: '//FRAME' }) as any
    expect(result.count).toBe(2)
    expect(result.nodes.every((n: any) => n.type === 'FRAME')).toBe(true)
  })

  test('finds by attribute //RECTANGLE[@width < 200]', async () => {
    const { figma } = setup()
    const small = figma.createRectangle()
    small.resize(100, 50)
    small.name = 'Small'
    const big = figma.createRectangle()
    big.resize(400, 400)
    big.name = 'Big'

    const tool = ALL_TOOLS.find((t) => t.name === 'query_nodes')!
    const result = await tool.execute(figma, { selector: '//RECTANGLE[@width < 200]' }) as any
    expect(result.count).toBe(1)
    expect(result.nodes[0].name).toBe('Small')
  })

  test('finds by name with contains', async () => {
    const { figma } = setup()
    const t1 = figma.createText()
    t1.name = 'Label Primary'
    const t2 = figma.createText()
    t2.name = 'Title'
    const t3 = figma.createText()
    t3.name = 'Label Secondary'

    const tool = ALL_TOOLS.find((t) => t.name === 'query_nodes')!
    const result = await tool.execute(figma, {
      selector: '//TEXT[contains(@name, "Label")]'
    }) as any
    expect(result.count).toBe(2)
    expect(result.nodes.every((n: any) => n.name.includes('Label'))).toBe(true)
  })

  test('returns error for invalid xpath', async () => {
    const { figma } = setup()
    const tool = ALL_TOOLS.find((t) => t.name === 'query_nodes')!
    const result = await tool.execute(figma, { selector: '///invalid[[[[' }) as any
    expect(result.error).toBeTruthy()
    expect(result.error).toContain('XPath error')
  })

  test('respects limit param', async () => {
    const { figma } = setup()
    for (let i = 0; i < 10; i++) {
      const r = figma.createRectangle()
      r.name = `Rect ${i}`
    }

    const tool = ALL_TOOLS.find((t) => t.name === 'query_nodes')!
    const result = await tool.execute(figma, { selector: '//RECTANGLE', limit: 3 }) as any
    expect(result.count).toBe(3)
  })

  test('returns empty array when nothing matches', async () => {
    const { figma } = setup()
    figma.createRectangle()

    const tool = ALL_TOOLS.find((t) => t.name === 'query_nodes')!
    const result = await tool.execute(figma, { selector: '//ELLIPSE' }) as any
    expect(result.count).toBe(0)
    expect(result.nodes).toEqual([])
  })
})

describe('get_node', () => {
  test('returns node details', () => {
    const { figma } = setup()
    const rect = figma.createRectangle()
    rect.name = 'Test Rect'
    rect.resize(100, 50)

    const tool = ALL_TOOLS.find((t) => t.name === 'get_node')!
    const result = tool.execute(figma, { id: rect.id }) as any
    expect(result.name).toBe('Test Rect')
    expect(result.width).toBe(100)
    expect(result.height).toBe(50)
  })
})

describe('page tools', () => {
  test('list_pages returns pages', () => {
    const { figma } = setup()
    const tool = ALL_TOOLS.find((t) => t.name === 'list_pages')!
    const result = tool.execute(figma, {}) as any
    expect(result.pages.length).toBeGreaterThanOrEqual(1)
  })

  test('switch_page changes page', () => {
    const { figma } = setup()
    const page2 = figma.createPage()
    page2.name = 'Page 2'

    const tool = ALL_TOOLS.find((t) => t.name === 'switch_page')!
    tool.execute(figma, { page: 'Page 2' })

    expect(figma.currentPage.name).toBe('Page 2')
  })

  test('switch_page persists across separate FigmaAPI instances (RPC simulation)', () => {
    const { graph } = setup()
    const switchPage = ALL_TOOLS.find((t) => t.name === 'switch_page')!
    const getCurrentPage = ALL_TOOLS.find((t) => t.name === 'get_current_page')!
    const createPage = ALL_TOOLS.find((t) => t.name === 'create_page')!

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
    const { figma } = setup()
    const tool = ALL_TOOLS.find((t) => t.name === 'eval')!
    const result = await tool.execute(figma, {
      code: 'const r = figma.createRectangle(); r.name = "FromEval"; return r.name;'
    })
    expect(result).toBe('FromEval')
  })
})

describe('set_constraints', () => {
  test('sets constraints', () => {
    const { figma } = setup()
    const rect = figma.createRectangle()
    rect.resize(100, 100)

    const tool = ALL_TOOLS.find((t) => t.name === 'set_constraints')!
    tool.execute(figma, { id: rect.id, horizontal: 'CENTER', vertical: 'STRETCH' })

    const node = figma.getNodeById(rect.id)!
    expect(node.constraints.horizontal).toBe('CENTER')
    expect(node.constraints.vertical).toBe('STRETCH')
  })
})

describe('render', () => {
  test('renders JSX string', async () => {
    const { figma } = setup()
    const tool = ALL_TOOLS.find((t) => t.name === 'render')!
    const result = (await tool.execute(figma, {
      jsx: '<Frame name="Card" w={200} h={100} bg="#FFF"><Text>Hello</Text></Frame>'
    })) as any
    expect(result.name).toBe('Card')
    expect(result.type).toBe('FRAME')
    expect(result.children.length).toBeGreaterThan(0)
  })
})
