import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '#core/figma-api'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

// Sizes recorded from Figma with locked layers in fixed auto layout frames, no padding or gap.
function row(graph: SceneGraph, overrides: Partial<SceneNode> = {}) {
  const page = graph.getPages()[0].id
  return graph.createNode('FRAME', page, {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    width: 300,
    height: 100,
    ...overrides
  })
}

function locked(graph: SceneGraph, parentId: string, overrides: Partial<SceneNode> = {}) {
  return graph.createNode('RECTANGLE', parentId, {
    width: 100,
    height: 50,
    targetAspectRatio: { x: 100, y: 50 },
    ...overrides
  })
}

function size(graph: SceneGraph, id: string) {
  const node = graph.getNode(id)
  return [node?.width, node?.height]
}

describe('locked aspect ratio in auto layout', () => {
  test('fill along the row sizes the height, past the frame', () => {
    const graph = new SceneGraph()
    const frame = row(graph, { width: 500 })
    const child = locked(graph, frame.id, { layoutGrow: 1 })
    computeAllLayouts(graph)
    expect(size(graph, child.id)).toEqual([500, 250])
  })

  test('fill shares the row with other fills and keeps its ratio', () => {
    const graph = new SceneGraph()
    const frame = row(graph, { width: 400 })
    const other = graph.createNode('RECTANGLE', frame.id, { width: 50, height: 50, layoutGrow: 1 })
    const child = locked(graph, frame.id, { layoutGrow: 1 })
    computeAllLayouts(graph)
    expect(size(graph, other.id)).toEqual([200, 50])
    expect(size(graph, child.id)).toEqual([200, 100])
  })

  test('fill along the column sizes the width, also when it fills across', () => {
    const graph = new SceneGraph()
    const frame = row(graph, { layoutMode: 'VERTICAL', width: 300, height: 400 })
    const child = locked(graph, frame.id, { layoutGrow: 1, layoutAlignSelf: 'STRETCH' })
    computeAllLayouts(graph)
    expect(size(graph, child.id)).toEqual([800, 400])
  })

  test('fill across the column sizes the height', () => {
    const graph = new SceneGraph()
    const frame = row(graph, { layoutMode: 'VERTICAL', width: 300, height: 400 })
    const child = locked(graph, frame.id, { layoutAlignSelf: 'STRETCH' })
    computeAllLayouts(graph)
    expect(size(graph, child.id)).toEqual([300, 150])
  })

  test('a frame that hugs across takes the derived size', () => {
    const graph = new SceneGraph()
    const frame = row(graph, { width: 400, height: 10, counterAxisSizing: 'HUG' })
    const child = locked(graph, frame.id, { layoutGrow: 1 })
    computeAllLayouts(graph)
    expect(size(graph, child.id)).toEqual([400, 200])
    expect(size(graph, frame.id)).toEqual([400, 200])
  })

  test('a maximum width caps the fill and the height follows', () => {
    const graph = new SceneGraph()
    const frame = row(graph, { width: 400 })
    const child = locked(graph, frame.id, { layoutGrow: 1, maxWidth: 200 })
    computeAllLayouts(graph)
    expect(size(graph, child.id)).toEqual([200, 100])
  })

  test('a locked auto layout frame that fills keeps its ratio', () => {
    const graph = new SceneGraph()
    const frame = row(graph, { width: 500 })
    const child = graph.createNode('FRAME', frame.id, {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      width: 100,
      height: 50,
      layoutGrow: 1,
      targetAspectRatio: { x: 100, y: 50 }
    })
    computeAllLayouts(graph)
    expect(size(graph, child.id)).toEqual([500, 250])
  })

  test('a fixed size ignores the lock', () => {
    const graph = new SceneGraph()
    const frame = row(graph)
    const fixed = locked(graph, frame.id, { width: 80 })
    computeAllLayouts(graph)
    expect(size(graph, fixed.id)).toEqual([80, 50])
  })
})

// Live Figma, 2026-10-10: a locked 100×50 layer at 50,50 that ignores auto layout, in a Hug row
// that grows from 200 to 300 wide.
describe('a locked layer that ignores auto layout as its Hug frame grows', () => {
  const CASES = {
    'STRETCH/MIN': [50, 50, 200, 100],
    'STRETCH/CENTER': [50, 25, 200, 100],
    'SCALE/MAX': [75, 25, 150, 75],
    'STRETCH/STRETCH': [50, 50, 200, 50]
  } as const

  for (const [name, expected] of Object.entries(CASES)) {
    test(name, () => {
      const figma = new FigmaAPI(new SceneGraph())
      const frame = figma.createFrame()
      frame.layoutMode = 'HORIZONTAL'
      frame.resize(10, 200)
      frame.counterAxisSizingMode = 'FIXED'
      frame.primaryAxisSizingMode = 'AUTO'
      for (const side of ['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom'] as const)
        frame[side] = 0
      const spacer = figma.createRectangle()
      spacer.resize(200, 10)
      frame.appendChild(spacer)
      // Figma has laid the frame out by now; ours lays out when its size is read.
      expect(frame.width).toBe(200)
      const layer = figma.createRectangle()
      frame.appendChild(layer)
      layer.layoutPositioning = 'ABSOLUTE'
      layer.x = 50
      layer.y = 50
      layer.resize(100, 50)
      const [horizontal, vertical] = name.split('/') as ['STRETCH' | 'SCALE', ConstraintName]
      layer.constraints = { horizontal, vertical }
      layer.lockAspectRatio()
      spacer.resize(300, 10)
      expect(frame.width).toBe(300)
      expect([layer.x, layer.y, layer.width, layer.height]).toEqual([...expected])
    })
  }
})

type ConstraintName = 'MIN' | 'CENTER' | 'MAX' | 'STRETCH'
