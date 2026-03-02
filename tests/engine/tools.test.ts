import { describe, expect, test } from 'bun:test'

import { ALL_TOOLS, FigmaAPI, SceneGraph } from '@open-pencil/core'

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

// ─── New tools (38 total) ─────────────────────────────────────

describe('get_children', () => {
  test('returns direct children of a frame', () => {
    const { figma } = setup()
    const parent = figma.createFrame()
    const child1 = figma.createRectangle()
    const child2 = figma.createEllipse()
    parent.appendChild(child1)
    parent.appendChild(child2)

    const tool = ALL_TOOLS.find((t) => t.name === 'get_children')!
    const result = tool.execute(figma, { id: parent.id }) as any
    expect(result.childCount).toBe(2)
    expect(result.children.map((c: any) => c.id)).toContain(child1.id)
    expect(result.children.map((c: any) => c.id)).toContain(child2.id)
  })

  test('returns error for unknown node', () => {
    const { figma } = setup()
    const tool = ALL_TOOLS.find((t) => t.name === 'get_children')!
    const result = tool.execute(figma, { id: 'nope' }) as any
    expect(result.error).toBeTruthy()
  })
})

describe('get_ancestors', () => {
  test('returns ancestor chain', () => {
    const { figma } = setup()
    const grandparent = figma.createFrame()
    const parent = figma.createFrame()
    const child = figma.createRectangle()
    grandparent.appendChild(parent)
    parent.appendChild(child)

    const tool = ALL_TOOLS.find((t) => t.name === 'get_ancestors')!
    const result = tool.execute(figma, { id: child.id }) as any
    const ids = result.ancestors.map((a: any) => a.id)
    expect(ids).toContain(parent.id)
    expect(ids).toContain(grandparent.id)
  })

  test('returns error for unknown node', () => {
    const { figma } = setup()
    const tool = ALL_TOOLS.find((t) => t.name === 'get_ancestors')!
    const result = tool.execute(figma, { id: 'nope' }) as any
    expect(result.error).toBeTruthy()
  })
})

describe('node_bounds', () => {
  test('returns bounding box for a positioned node', () => {
    const { figma } = setup()
    const node = figma.createRectangle()
    node.x = 50
    node.y = 80
    node.resize(120, 60)

    const tool = ALL_TOOLS.find((t) => t.name === 'node_bounds')!
    const result = tool.execute(figma, { id: node.id }) as any
    expect(result.x).toBe(50)
    expect(result.y).toBe(80)
    expect(result.width).toBe(120)
    expect(result.height).toBe(60)
  })
})

describe('set_text', () => {
  test('sets text content on a TEXT node', () => {
    const { figma } = setup()
    const node = figma.createText()

    const tool = ALL_TOOLS.find((t) => t.name === 'set_text')!
    tool.execute(figma, { id: node.id, text: 'Hello World' })
    expect(node.characters).toBe('Hello World')
  })

  test('returns error when node is not TEXT', () => {
    const { figma } = setup()
    const node = figma.createRectangle()
    const tool = ALL_TOOLS.find((t) => t.name === 'set_text')!
    const result = tool.execute(figma, { id: node.id, text: 'oops' }) as any
    expect(result.error).toMatch(/not a TEXT node/)
  })
})

describe('set_font', () => {
  test('sets font size and weight', () => {
    const { figma } = setup()
    const node = figma.createText()

    const tool = ALL_TOOLS.find((t) => t.name === 'set_font')!
    tool.execute(figma, { id: node.id, size: 24, weight: 700 })
    expect(node.fontSize).toBe(24)
    expect(node.fontWeight).toBe(700)
  })

  test('sets font family', () => {
    const { figma } = setup()
    const node = figma.createText()
    const tool = ALL_TOOLS.find((t) => t.name === 'set_font')!
    tool.execute(figma, { id: node.id, family: 'Roboto', weight: 400 })
    expect(node.fontName.family).toBe('Roboto')
  })

  test('sets line height and letter spacing', () => {
    const { figma } = setup()
    const node = figma.createText()
    const tool = ALL_TOOLS.find((t) => t.name === 'set_font')!
    tool.execute(figma, { id: node.id, line_height: 28, letter_spacing: 0.5 })
    expect(node.lineHeight).toBe(28)
    expect(node.letterSpacing).toBe(0.5)
  })

  test('returns error for non-TEXT node', () => {
    const { figma } = setup()
    const node = figma.createRectangle()
    const tool = ALL_TOOLS.find((t) => t.name === 'set_font')!
    const result = tool.execute(figma, { id: node.id, size: 16 }) as any
    expect(result.error).toMatch(/not a TEXT node/)
  })
})

describe('set_text_properties', () => {
  test('sets horizontal and vertical alignment', () => {
    const { figma } = setup()
    const node = figma.createText()
    const tool = ALL_TOOLS.find((t) => t.name === 'set_text_properties')!
    tool.execute(figma, { id: node.id, align_horizontal: 'CENTER', align_vertical: 'CENTER' })
    expect(node.textAlignHorizontal).toBe('CENTER')
    expect(node.textAlignVertical).toBe('CENTER')
  })

  test('sets auto-resize and text case', () => {
    const { figma } = setup()
    const node = figma.createText()
    const tool = ALL_TOOLS.find((t) => t.name === 'set_text_properties')!
    tool.execute(figma, { id: node.id, auto_resize: 'HEIGHT', text_case: 'UPPER' })
    expect(node.textAutoResize).toBe('HEIGHT')
    expect(node.textCase).toBe('UPPER')
  })

  test('returns error for non-TEXT node', () => {
    const { figma } = setup()
    const node = figma.createFrame()
    const tool = ALL_TOOLS.find((t) => t.name === 'set_text_properties')!
    const result = tool.execute(figma, { id: node.id, align_horizontal: 'LEFT' }) as any
    expect(result.error).toMatch(/not a TEXT node/)
  })
})

describe('set_blend_mode', () => {
  test('sets blend mode', () => {
    const { figma } = setup()
    const node = figma.createRectangle()
    const tool = ALL_TOOLS.find((t) => t.name === 'set_blend_mode')!
    tool.execute(figma, { id: node.id, blend_mode: 'MULTIPLY' })
    expect(node.blendMode).toBe('MULTIPLY')
  })

  test('sets rotation', () => {
    const { figma } = setup()
    const node = figma.createRectangle()
    const tool = ALL_TOOLS.find((t) => t.name === 'set_blend_mode')!
    tool.execute(figma, { id: node.id, rotation: 45 })
    expect(node.rotation).toBe(45)
  })
})

describe('set_layout_child', () => {
  test('sets layout sizing and grow', () => {
    const { figma } = setup()
    const frame = figma.createFrame()
    frame.layoutMode = 'HORIZONTAL'
    const child = figma.createRectangle()
    frame.appendChild(child)

    const tool = ALL_TOOLS.find((t) => t.name === 'set_layout_child')!
    tool.execute(figma, { id: child.id, sizing_horizontal: 'FILL', grow: 1 })
    expect(child.layoutGrow).toBe(1)
  })

  test('sets absolute positioning', () => {
    const { figma } = setup()
    const frame = figma.createFrame()
    frame.layoutMode = 'VERTICAL'
    const child = figma.createRectangle()
    frame.appendChild(child)

    const tool = ALL_TOOLS.find((t) => t.name === 'set_layout_child')!
    tool.execute(figma, { id: child.id, positioning: 'ABSOLUTE' })
    expect(child.layoutPositioning).toBe('ABSOLUTE')
  })
})

describe('create_page', () => {
  test('creates a page with the given name', () => {
    const { figma } = setup()
    const tool = ALL_TOOLS.find((t) => t.name === 'create_page')!
    const result = tool.execute(figma, { name: 'Flows' }) as any
    expect(result.name).toBe('Flows')
    expect(result.id).toBeTruthy()
    const pages = figma.root.children
    expect(pages.some((p) => p.id === result.id)).toBe(true)
  })
})

describe('create_variable', () => {
  test('creates a FLOAT variable with auto-created collection', () => {
    const { figma } = setup()
    const tool = ALL_TOOLS.find((t) => t.name === 'create_variable')!
    const result = tool.execute(figma, { name: 'spacing-md', type: 'FLOAT', value: '16' }) as any
    expect(result.name).toBe('spacing-md')
    expect(result.type).toBe('FLOAT')
    expect(result.id).toBeTruthy()
    const variable = figma.graph.variables.get(result.id)!
    expect(Object.values(variable.valuesByMode)[0]).toBe(16)
  })

  test('creates a COLOR variable', () => {
    const { figma } = setup()
    const tool = ALL_TOOLS.find((t) => t.name === 'create_variable')!
    const result = tool.execute(figma, { name: 'brand', type: 'COLOR', value: '#ff0000' }) as any
    const variable = figma.graph.variables.get(result.id)!
    const color = Object.values(variable.valuesByMode)[0] as any
    expect(color.r).toBeCloseTo(1)
    expect(color.g).toBeCloseTo(0)
    expect(color.b).toBeCloseTo(0)
  })

  test('creates a BOOLEAN variable', () => {
    const { figma } = setup()
    const tool = ALL_TOOLS.find((t) => t.name === 'create_variable')!
    const result = tool.execute(figma, { name: 'darkMode', type: 'BOOLEAN', value: 'true' }) as any
    const variable = figma.graph.variables.get(result.id)!
    expect(Object.values(variable.valuesByMode)[0]).toBe(true)
  })

  test('creates a STRING variable', () => {
    const { figma } = setup()
    const tool = ALL_TOOLS.find((t) => t.name === 'create_variable')!
    const result = tool.execute(figma, { name: 'label', type: 'STRING', value: 'Hello' }) as any
    const variable = figma.graph.variables.get(result.id)!
    expect(Object.values(variable.valuesByMode)[0]).toBe('Hello')
  })

  test('uses existing collection when specified', () => {
    const { figma } = setup()
    const modeId = 'mode-1'
    const col = {
      id: 'col-1', name: 'Tokens',
      modes: [{ modeId, name: 'Default' }],
      defaultModeId: modeId, variableIds: []
    }
    figma.graph.addCollection(col)
    const tool = ALL_TOOLS.find((t) => t.name === 'create_variable')!
    const result = tool.execute(figma, {
      name: 'radius', type: 'FLOAT', value: '8', collection_id: 'col-1'
    }) as any
    expect(result.collectionId).toBe('col-1')
  })
})

describe('set_variable_value', () => {
  test('updates the value in the default mode', () => {
    const { figma } = setup()
    const createTool = ALL_TOOLS.find((t) => t.name === 'create_variable')!
    const { id } = createTool.execute(figma, { name: 'gap', type: 'FLOAT', value: '8' }) as any

    const setTool = ALL_TOOLS.find((t) => t.name === 'set_variable_value')!
    setTool.execute(figma, { id, value: '16' })

    const variable = figma.graph.variables.get(id)!
    expect(Object.values(variable.valuesByMode)[0]).toBe(16)
  })

  test('returns error for unknown variable', () => {
    const { figma } = setup()
    const tool = ALL_TOOLS.find((t) => t.name === 'set_variable_value')!
    const result = tool.execute(figma, { id: 'no-such', value: '1' }) as any
    expect(result.error).toBeTruthy()
  })
})

describe('bind_variable', () => {
  test('binds a variable to a node field', () => {
    const { figma } = setup()
    const createTool = ALL_TOOLS.find((t) => t.name === 'create_variable')!
    const { id: varId } = createTool.execute(figma, {
      name: 'opacity-dim', type: 'FLOAT', value: '0.5'
    }) as any

    const node = figma.createRectangle()
    const tool = ALL_TOOLS.find((t) => t.name === 'bind_variable')!
    tool.execute(figma, { node_id: node.id, field: 'opacity', variable_id: varId })

    const raw = figma.graph.getNode(node.id)!
    expect(raw.boundVariables['opacity']).toBe(varId)
  })

  test('returns error for unknown node', () => {
    const { figma } = setup()
    const createTool = ALL_TOOLS.find((t) => t.name === 'create_variable')!
    const { id: varId } = createTool.execute(figma, {
      name: 'x', type: 'FLOAT', value: '0'
    }) as any
    const tool = ALL_TOOLS.find((t) => t.name === 'bind_variable')!
    const result = tool.execute(figma, {
      node_id: 'no-node', field: 'opacity', variable_id: varId
    }) as any
    expect(result.error).toBeTruthy()
  })

  test('returns error for unknown variable', () => {
    const { figma } = setup()
    const node = figma.createRectangle()
    const tool = ALL_TOOLS.find((t) => t.name === 'bind_variable')!
    const result = tool.execute(figma, {
      node_id: node.id, field: 'opacity', variable_id: 'no-var'
    }) as any
    expect(result.error).toBeTruthy()
  })
})

describe('ALL_TOOLS count', () => {
  test('has 38 tools registered', () => {
    expect(ALL_TOOLS.length).toBe(38)
  })
})
