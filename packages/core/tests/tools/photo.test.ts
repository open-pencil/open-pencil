import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@lawha/core/figma-api'
import { ALL_TOOLS, isToolExposed } from '@lawha/core/tools'
import { SceneGraph, type Fill } from '@lawha/scene-graph'

const tool = ALL_TOOLS.find((t) => t.name === 'set_image_adjustments')
if (!tool) throw new Error('set_image_adjustments missing')
const run = (figma: FigmaAPI, args: Record<string, unknown>) => tool.execute(figma, args)

const image = (extra: Partial<Fill> = {}): Fill => ({
  type: 'IMAGE',
  imageHash: 'c'.repeat(40),
  imageScaleMode: 'FILL',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  ...extra
})
const solid: Fill = { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }

function setup(fills: Fill[]) {
  const graph = new SceneGraph()
  const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    width: 10,
    height: 10,
    fills
  })
  return { figma: new FigmaAPI(graph), graph, id: node.id }
}

describe('set_image_adjustments', () => {
  test('targets the first image fill, keeping the other fills', () => {
    const { figma, graph, id } = setup([solid, image()])
    expect(run(figma, { id, exposure: 0.4, invert: true })).toMatchObject({ fill_index: 1 })
    const fills = graph.getNode(id)?.fills ?? []
    expect(fills[0]).toEqual(solid)
    expect(fills[1].adjustments).toEqual({ exposure: 0.4, invert: true })
  })

  test('merges with what is set; zeros and false clear a value', () => {
    const { figma, graph, id } = setup([image({ adjustments: { contrast: 0.2, hue: 0.5 } })])
    run(figma, { id, saturation: -1, hue: 0 })
    expect(graph.getNode(id)?.fills[0].adjustments).toEqual({ contrast: 0.2, saturation: -1 })
  })

  test('reset clears everything first; clearing all removes the key', () => {
    const { figma, graph, id } = setup([image({ adjustments: { contrast: 0.2 } })])
    run(figma, { id, reset: true, tint: 0.1 })
    expect(graph.getNode(id)?.fills[0].adjustments).toEqual({ tint: 0.1 })
    run(figma, { id, reset: true })
    expect(graph.getNode(id)?.fills[0]).not.toHaveProperty('adjustments')
  })

  test('refuses layers without an image fill and values outside -1…1', () => {
    const { figma, id } = setup([solid])
    expect(run(figma, { id, exposure: 0.1 })).toMatchObject({ error: expect.any(String) })
    const other = setup([image()])
    expect(() => run(other.figma, { id: other.id, exposure: 3 })).toThrow()
  })

  test('sets levels and a curve; the curve is sorted, and identity values are dropped', () => {
    const { figma, graph, id } = setup([image()])
    run(figma, {
      id,
      levels: { black: 0.1, white: 0.8, gamma: 1.2 },
      curve: [
        { x: 1, y: 1 },
        { x: 0, y: 0 },
        { x: 0.5, y: 0.7 }
      ]
    })
    expect(graph.getNode(id)?.fills[0].adjustments).toEqual({
      levels: { black: 0.1, white: 0.8, gamma: 1.2 },
      curve: [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.7 },
        { x: 1, y: 1 }
      ]
    })
    run(figma, {
      id,
      levels: { black: 0, white: 1, gamma: 1 },
      curve: [
        { x: 0, y: 0 },
        { x: 1, y: 1 }
      ]
    })
    expect(graph.getNode(id)?.fills[0]).not.toHaveProperty('adjustments')
  })

  test('reaches AI chat and MCP', () => {
    expect(isToolExposed(tool, 'mcp') && isToolExposed(tool, 'ai')).toBe(true)
  })
})
