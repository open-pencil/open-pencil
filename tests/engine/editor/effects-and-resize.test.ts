import { describe, test, expect } from 'bun:test'

import { SceneGraph, type Effect } from '@open-pencil/core'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function makeEffect(overrides: Partial<Effect> = {}): Effect {
  return {
    type: 'DROP_SHADOW',
    color: { r: 0, g: 0, b: 0, a: 0.25 },
    offset: { x: 0, y: 4 },
    radius: 4,
    spread: 0,
    visible: true,
    ...overrides
  }
}

describe('Effect types on scene graph', () => {
  test('drop shadow with spread value', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Card',
      width: 200,
      height: 100
    })
    graph.updateNode(node.id, {
      effects: [makeEffect({ spread: 10 })]
    })
    const updated = graph.getNode(node.id)!
    expect(updated.effects[0].spread).toBe(10)
  })

  test('inner shadow with spread value', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Card',
      width: 200,
      height: 100
    })
    graph.updateNode(node.id, {
      effects: [makeEffect({ type: 'INNER_SHADOW', spread: 5 })]
    })
    const updated = graph.getNode(node.id)!
    expect(updated.effects[0].type).toBe('INNER_SHADOW')
    expect(updated.effects[0].spread).toBe(5)
  })

  test('background blur effect', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('FRAME', pageId(graph), {
      name: 'GlassCard',
      width: 300,
      height: 200
    })
    graph.updateNode(node.id, {
      effects: [makeEffect({ type: 'BACKGROUND_BLUR', radius: 20 })]
    })
    const updated = graph.getNode(node.id)!
    expect(updated.effects[0].type).toBe('BACKGROUND_BLUR')
    expect(updated.effects[0].radius).toBe(20)
  })

  test('foreground blur effect', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('FRAME', pageId(graph), {
      name: 'FrostedOverlay',
      width: 300,
      height: 200
    })
    graph.updateNode(node.id, {
      effects: [makeEffect({ type: 'FOREGROUND_BLUR', radius: 8 })]
    })
    const updated = graph.getNode(node.id)!
    expect(updated.effects[0].type).toBe('FOREGROUND_BLUR')
    expect(updated.effects[0].radius).toBe(8)
  })

  test('layer blur effect', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Blurred',
      width: 100,
      height: 100
    })
    graph.updateNode(node.id, {
      effects: [makeEffect({ type: 'LAYER_BLUR', radius: 12 })]
    })
    const updated = graph.getNode(node.id)!
    expect(updated.effects[0].type).toBe('LAYER_BLUR')
    expect(updated.effects[0].radius).toBe(12)
  })

  test('text node with drop shadow', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'ShadowedText',
      width: 200,
      height: 50,
      text: 'Hello'
    })
    graph.updateNode(node.id, {
      effects: [makeEffect({ type: 'DROP_SHADOW', radius: 4, offset: { x: 2, y: 2 } })]
    })
    const updated = graph.getNode(node.id)!
    expect(updated.type).toBe('TEXT')
    expect(updated.effects[0].type).toBe('DROP_SHADOW')
  })

  test('text node with inner shadow', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'InnerShadowText',
      width: 200,
      height: 50,
      text: 'Hello'
    })
    graph.updateNode(node.id, {
      effects: [makeEffect({ type: 'INNER_SHADOW', radius: 2, offset: { x: 1, y: 1 } })]
    })
    const updated = graph.getNode(node.id)!
    expect(updated.type).toBe('TEXT')
    expect(updated.effects[0].type).toBe('INNER_SHADOW')
  })

  test('multiple effects on single node', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('FRAME', pageId(graph), {
      name: 'MultiEffect',
      width: 300,
      height: 200
    })
    graph.updateNode(node.id, {
      effects: [
        makeEffect({ type: 'DROP_SHADOW', radius: 8, spread: 2 }),
        makeEffect({ type: 'INNER_SHADOW', radius: 4, spread: 1 }),
        makeEffect({ type: 'BACKGROUND_BLUR', radius: 16 }),
        makeEffect({ type: 'LAYER_BLUR', radius: 4 })
      ]
    })
    const updated = graph.getNode(node.id)!
    expect(updated.effects).toHaveLength(4)
    expect(updated.effects.map((e) => e.type)).toEqual([
      'DROP_SHADOW',
      'INNER_SHADOW',
      'BACKGROUND_BLUR',
      'LAYER_BLUR'
    ])
  })

  test('invisible effect is preserved', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Hidden',
      width: 100,
      height: 100
    })
    graph.updateNode(node.id, {
      effects: [makeEffect({ visible: false })]
    })
    expect(graph.getNode(node.id)!.effects[0].visible).toBe(false)
  })

  test('drop shadow with negative spread (inset shrink)', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'ShrunkShadow',
      width: 100,
      height: 100
    })
    graph.updateNode(node.id, {
      effects: [makeEffect({ spread: -5 })]
    })
    expect(graph.getNode(node.id)!.effects[0].spread).toBe(-5)
  })
})

describe('Resize logic', () => {
  function applyResize(
    handle: string,
    origRect: { x: number; y: number; width: number; height: number },
    startX: number,
    startY: number,
    cx: number,
    cy: number,
    constrain = false
  ) {
    let { x, y, width, height } = origRect
    const dx = cx - startX
    const dy = cy - startY

    const moveLeft = handle.includes('w')
    const moveRight = handle.includes('e')
    const moveTop = handle === 'nw' || handle === 'n' || handle === 'ne'
    const moveBottom = handle === 'sw' || handle === 's' || handle === 'se'

    if (moveRight) width = origRect.width + dx
    if (moveLeft) {
      x = origRect.x + dx
      width = origRect.width - dx
    }
    if (moveBottom) height = origRect.height + dy
    if (moveTop) {
      y = origRect.y + dy
      height = origRect.height - dy
    }

    if (constrain && origRect.width > 0 && origRect.height > 0) {
      const aspect = origRect.width / origRect.height
      if (handle === 'n' || handle === 's') {
        width = Math.abs(height) * aspect
        x = origRect.x + (origRect.width - width) / 2
      } else if (handle === 'e' || handle === 'w') {
        height = Math.abs(width) / aspect
        y = origRect.y + (origRect.height - height) / 2
      } else {
        if (Math.abs(dx) > Math.abs(dy)) {
          height = (Math.abs(width) / aspect) * Math.sign(height || 1)
          if (moveTop) y = origRect.y + origRect.height - Math.abs(height)
        } else {
          width = Math.abs(height) * aspect * Math.sign(width || 1)
          if (moveLeft) x = origRect.x + origRect.width - Math.abs(width)
        }
      }
    }

    if (width < 0) {
      x = x + width
      width = -width
    }
    if (height < 0) {
      y = y + height
      height = -height
    }

    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(Math.max(1, width)),
      height: Math.round(Math.max(1, height))
    }
  }

  const orig = { x: 100, y: 100, width: 200, height: 100 }

  test('east handle: grow right', () => {
    const result = applyResize('e', orig, 300, 150, 350, 150)
    expect(result).toEqual({ x: 100, y: 100, width: 250, height: 100 })
  })

  test('east handle: shrink right', () => {
    const result = applyResize('e', orig, 300, 150, 250, 150)
    expect(result).toEqual({ x: 100, y: 100, width: 150, height: 100 })
  })

  test('east handle: drag past opposite bound', () => {
    const result = applyResize('e', orig, 300, 150, 50, 150)
    expect(result.x).toBe(50)
    expect(result.width).toBe(50)
    expect(result.y).toBe(100)
    expect(result.height).toBe(100)
  })

  test('west handle: grow left', () => {
    const result = applyResize('w', orig, 100, 150, 50, 150)
    expect(result).toEqual({ x: 50, y: 100, width: 250, height: 100 })
  })

  test('west handle: shrink left', () => {
    const result = applyResize('w', orig, 100, 150, 150, 150)
    expect(result).toEqual({ x: 150, y: 100, width: 150, height: 100 })
  })

  test('west handle: drag past opposite bound', () => {
    const result = applyResize('w', orig, 100, 150, 350, 150)
    expect(result.width).toBe(50)
    expect(result.x).toBe(300)
  })

  test('north handle: grow up', () => {
    const result = applyResize('n', orig, 200, 100, 200, 50)
    expect(result).toEqual({ x: 100, y: 50, width: 200, height: 150 })
  })

  test('north handle: shrink up', () => {
    const result = applyResize('n', orig, 200, 100, 200, 150)
    expect(result).toEqual({ x: 100, y: 150, width: 200, height: 50 })
  })

  test('north handle: drag past opposite bound', () => {
    const result = applyResize('n', orig, 200, 100, 200, 250)
    expect(result.height).toBe(50)
    expect(result.y).toBe(200)
  })

  test('south handle: grow down', () => {
    const result = applyResize('s', orig, 200, 200, 200, 250)
    expect(result).toEqual({ x: 100, y: 100, width: 200, height: 150 })
  })

  test('south handle: drag past opposite bound', () => {
    const result = applyResize('s', orig, 200, 200, 200, 50)
    expect(result.height).toBe(50)
    expect(result.y).toBe(50)
  })

  test('nw handle: grow both axes', () => {
    const result = applyResize('nw', orig, 100, 100, 50, 50)
    expect(result).toEqual({ x: 50, y: 50, width: 250, height: 150 })
  })

  test('nw handle: shrink both axes', () => {
    const result = applyResize('nw', orig, 100, 100, 200, 150)
    expect(result).toEqual({ x: 200, y: 150, width: 100, height: 50 })
  })

  test('nw handle: drag past opposite corner', () => {
    const result = applyResize('nw', orig, 100, 100, 350, 250)
    expect(result.x).toBe(300)
    expect(result.y).toBe(200)
    expect(result.width).toBe(50)
    expect(result.height).toBe(50)
  })

  test('se handle: grow both axes', () => {
    const result = applyResize('se', orig, 300, 200, 350, 250)
    expect(result).toEqual({ x: 100, y: 100, width: 250, height: 150 })
  })

  test('se handle: drag past opposite corner', () => {
    const result = applyResize('se', orig, 300, 200, 50, 50)
    expect(result.x).toBe(50)
    expect(result.y).toBe(50)
    expect(result.width).toBe(50)
    expect(result.height).toBe(50)
  })

  test('ne handle: grow right and up', () => {
    const result = applyResize('ne', orig, 300, 100, 350, 50)
    expect(result).toEqual({ x: 100, y: 50, width: 250, height: 150 })
  })

  test('sw handle: grow left and down', () => {
    const result = applyResize('sw', orig, 100, 200, 50, 250)
    expect(result).toEqual({ x: 50, y: 100, width: 250, height: 150 })
  })

  test('opposite edge stays fixed when resizing left', () => {
    const result = applyResize('w', orig, 100, 150, 50, 150)
    expect(result.x + result.width).toBe(300)
  })

  test('opposite edge stays fixed when resizing top', () => {
    const result = applyResize('n', orig, 200, 100, 200, 50)
    expect(result.y + result.height).toBe(200)
  })

  test('opposite edge stays fixed when resizing nw', () => {
    const result = applyResize('nw', orig, 100, 100, 50, 50)
    expect(result.x + result.width).toBe(300)
    expect(result.y + result.height).toBe(200)
  })

  test('width never goes below 1', () => {
    const result = applyResize('e', orig, 300, 150, 100, 150)
    expect(result.width).toBeGreaterThanOrEqual(1)
  })

  test('height never goes below 1', () => {
    const result = applyResize('s', orig, 200, 200, 200, 100)
    expect(result.height).toBeGreaterThanOrEqual(1)
  })

  test('constrained se preserves aspect ratio', () => {
    const result = applyResize('se', orig, 300, 200, 400, 200, true)
    const aspect = result.width / result.height
    expect(Math.abs(aspect - 2)).toBeLessThan(0.01)
  })

  test('constrained nw preserves aspect ratio', () => {
    const result = applyResize('nw', orig, 100, 100, 0, 100, true)
    const aspect = result.width / result.height
    expect(Math.abs(aspect - 2)).toBeLessThan(0.01)
  })
})
