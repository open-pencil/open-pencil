import { describe, expect, test } from 'bun:test'

import { computeAllLayouts } from '@open-pencil/core'

import { ALL_TOOLS, getTool, setupToolTest, type ToolResult } from '../../helpers/tools'

describe('set_fill', () => {
  test('sets solid fill', () => {
    const { figma } = setupToolTest()
    const frame = figma.createFrame()
    frame.resize(100, 100)

    const tool = getTool('set_fill')
    tool.execute(figma, { id: frame.id, color: '#ff0000' })

    const fills = figma.getNodeById(frame.id)!.fills
    expect(fills.length).toBe(1)
    expect(fills[0].color.r).toBeCloseTo(1)
    expect(fills[0].color.g).toBeCloseTo(0)
    expect(fills[0].color.b).toBeCloseTo(0)
  })

  test('returns error for missing node', () => {
    const { figma } = setupToolTest()
    const tool = getTool('set_fill')
    const result = tool.execute(figma, { id: 'nonexistent', color: '#ff0000' }) as ToolResult
    expect(result.error).toContain('not found')
  })
})

describe('set_stroke', () => {
  test('sets stroke', () => {
    const { figma } = setupToolTest()
    const rect = figma.createRectangle()
    rect.resize(100, 100)

    const tool = getTool('set_stroke')
    tool.execute(figma, { id: rect.id, color: '#0000ff', weight: 2 })

    const strokes = figma.getNodeById(rect.id)!.strokes
    expect(strokes.length).toBe(1)
    expect(strokes[0].color.b).toBeCloseTo(1)
    expect(strokes[0].weight).toBe(2)
  })
})

describe('set_effects', () => {
  test('adds drop shadow', () => {
    const { figma } = setupToolTest()
    const frame = figma.createFrame()
    frame.resize(100, 100)

    const tool = getTool('set_effects')
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
    const { figma } = setupToolTest()
    const frame = figma.createFrame()
    frame.resize(100, 100)

    const tool = getTool('set_effects')
    tool.execute(figma, { id: frame.id, type: 'BACKGROUND_BLUR', radius: 10 })

    const effects = figma.getNodeById(frame.id)!.effects
    expect(effects.length).toBe(1)
    expect(effects[0].type).toBe('BACKGROUND_BLUR')
  })
})

describe('update_node', () => {
  test('updates position and size', () => {
    const { figma } = setupToolTest()
    const rect = figma.createRectangle()
    rect.resize(100, 100)

    const tool = getTool('update_node')
    const result = tool.execute(figma, {
      id: rect.id,
      x: 50,
      y: 75,
      width: 200,
      height: 150,
      opacity: 0.5
    }) as ToolResult

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
    const { figma } = setupToolTest()
    const rect = figma.createRectangle()
    rect.resize(100, 100)

    const tool = getTool('update_node')
    tool.execute(figma, { id: rect.id, corner_radius: 12 })

    expect(figma.getNodeById(rect.id)!.cornerRadius).toBe(12)
  })
})

describe('set_layout', () => {
  test('sets auto-layout', () => {
    const { figma } = setupToolTest()
    const frame = figma.createFrame()
    frame.resize(300, 200)

    const tool = getTool('set_layout')
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
    const { graph, figma } = setupToolTest()
    const frame = figma.createFrame()
    frame.resize(300, 200)

    const rawBefore = graph.getNode(frame.id)!
    expect(rawBefore.layoutMode).toBe('NONE')
    expect(rawBefore.primaryAxisSizing).toBe('FIXED')
    expect(rawBefore.counterAxisSizing).toBe('FIXED')

    const tool = getTool('set_layout')
    tool.execute(figma, { id: frame.id, direction: 'VERTICAL' })

    const rawAfter = graph.getNode(frame.id)!
    expect(rawAfter.layoutMode).toBe('VERTICAL')
    expect(rawAfter.primaryAxisSizing).toBe('HUG')
    expect(rawAfter.counterAxisSizing).toBe('HUG')
  })

  test('preserves sizing modes when updating existing auto-layout', () => {
    const { graph, figma } = setupToolTest()
    const frame = figma.createFrame()
    frame.resize(300, 200)

    const tool = getTool('set_layout')
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
    const { graph, figma } = setupToolTest()
    const frame = figma.createFrame()
    frame.resize(320, 100)

    const tool = getTool('set_layout')
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

describe('set_constraints', () => {
  test('sets constraints', () => {
    const { figma } = setupToolTest()
    const rect = figma.createRectangle()
    rect.resize(100, 100)

    const tool = getTool('set_constraints')
    tool.execute(figma, { id: rect.id, horizontal: 'CENTER', vertical: 'STRETCH' })

    const node = figma.getNodeById(rect.id)!
    expect(node.constraints.horizontal).toBe('CENTER')
    expect(node.constraints.vertical).toBe('STRETCH')
  })
})

describe('set_font_range', () => {
  test('applies font style to text range and survives serialization', () => {
    const { figma, graph } = setupToolTest()
    const createText = getTool('create_shape')
    const setText = getTool('set_text')
    const setFontRange = getTool('set_font_range')

    const created = createText.execute(figma, {
      type: 'TEXT',
      x: 0,
      y: 0,
      width: 200,
      height: 20
    }) as ToolResult
    setText.execute(figma, { id: created.id, text: 'Hello World' })
    setFontRange.execute(figma, {
      id: created.id,
      start: 0,
      end: 5,
      family: 'Inter',
      size: 18,
      style: 'Bold'
    })

    const node = graph.getNode(created.id)!
    expect(node.styleRuns.length).toBeGreaterThan(0)
    for (const run of node.styleRuns) {
      expect(run.style).toBeDefined()
      expect(typeof run.start).toBe('number')
      expect(typeof run.length).toBe('number')
    }
    const boldRun = node.styleRuns.find((r) => r.style.fontWeight === 700)
    expect(boldRun).toBeDefined()
    expect(boldRun!.start).toBe(0)
    expect(boldRun!.length).toBe(5)
  })

  test('applies color to text range', () => {
    const { figma, graph } = setupToolTest()
    const createText = getTool('create_shape')
    const setText = getTool('set_text')
    const setFontRange = getTool('set_font_range')

    const created = createText.execute(figma, {
      type: 'TEXT',
      x: 0,
      y: 0,
      width: 200,
      height: 20
    }) as ToolResult
    setText.execute(figma, { id: created.id, text: 'Red text' })
    setFontRange.execute(figma, { id: created.id, start: 0, end: 3, color: '#ff0000' })

    const node = graph.getNode(created.id)!
    const colorRun = node.styleRuns.find((r) => r.style.fills?.length)
    expect(colorRun).toBeDefined()
    expect(colorRun!.style.fills![0].color.r).toBeCloseTo(1)
  })
})
