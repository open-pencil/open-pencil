import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { FigmaAPI, type FigmaNodeProxy } from '#core/figma-api'
import { computeAllLayouts } from '#core/layout'

type Direction = 'HORIZONTAL' | 'VERTICAL'

function stack(direction: Direction, spacing: number) {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const frame = figma.createFrame()
  frame.layoutMode = direction
  frame.itemSpacing = spacing
  const children = [0, 1, 2].map(() => {
    const child = figma.createRectangle()
    child.resize(40, 20)
    frame.appendChild(child)
    return child
  })
  frame.layoutSizingHorizontal = 'HUG'
  frame.layoutSizingVertical = 'HUG'
  const layout = () => computeAllLayouts(graph, graph.getPages()[0].id)
  return { graph, figma, frame, children, layout }
}

function xs(nodes: FigmaNodeProxy[]): number[] {
  return nodes.map((node) => node.x)
}

function ys(nodes: FigmaNodeProxy[]): number[] {
  return nodes.map((node) => node.y)
}

describe('negative item spacing overlaps siblings', () => {
  test('a Hug row shrinks by the overlap', () => {
    const { frame, children, layout } = stack('HORIZONTAL', -6)
    layout()
    expect(xs(children)).toEqual([0, 34, 68])
    expect([frame.width, frame.height]).toEqual([108, 20])
  })

  test('a Hug column shrinks by the overlap', () => {
    const { frame, children, layout } = stack('VERTICAL', -6)
    layout()
    expect(ys(children)).toEqual([0, 14, 28])
    expect([frame.width, frame.height]).toEqual([40, 48])
  })

  test('a fixed row aligns the overlapped content', () => {
    const { frame, children, layout } = stack('HORIZONTAL', -6)
    frame.layoutSizingHorizontal = 'FIXED'
    frame.resize(200, 20)
    frame.primaryAxisAlignItems = 'CENTER'
    layout()
    expect(xs(children)).toEqual([46, 80, 114])
    expect(frame.width).toBe(200)
  })

  test('a fixed column keeps its height', () => {
    const { frame, children, layout } = stack('VERTICAL', -6)
    frame.layoutSizingVertical = 'FIXED'
    frame.resize(40, 100)
    layout()
    expect(ys(children)).toEqual([0, 14, 28])
    expect(frame.height).toBe(100)
  })

  test('a hidden child takes no part in the overlap', () => {
    const { frame, children, layout } = stack('HORIZONTAL', -6)
    const [hidden, ...shown] = children
    hidden.visible = false
    layout()
    expect(xs(shown)).toEqual([0, 34])
    expect(frame.width).toBe(74)
  })

  test('an absolute child takes no part in the overlap', () => {
    const { frame, children, layout } = stack('HORIZONTAL', -6)
    const [floating, ...flowing] = children
    floating.layoutPositioning = 'ABSOLUTE'
    floating.x = 5
    layout()
    expect(floating.x).toBe(5)
    expect(xs(flowing)).toEqual([0, 34])
    expect(frame.width).toBe(74)
  })

  test('a right-to-left row overlaps toward its start', () => {
    const { graph, frame, children, layout } = stack('HORIZONTAL', -6)
    graph.updateNode(frame.id, { layoutDirection: 'RTL' })
    layout()
    expect(xs(children)).toEqual([68, 34, 0])
    expect(frame.width).toBe(108)
  })

  test('a nested row reports its overlapped size to its parent', () => {
    const { figma, frame, layout } = stack('HORIZONTAL', -6)
    const outer = figma.createFrame()
    outer.layoutMode = 'VERTICAL'
    outer.appendChild(frame)
    outer.layoutSizingHorizontal = 'HUG'
    outer.layoutSizingVertical = 'HUG'
    layout()
    expect([outer.width, frame.width]).toEqual([108, 108])
  })

  test('space between ignores the negative spacing', () => {
    const { frame, children, layout } = stack('HORIZONTAL', -6)
    frame.layoutSizingHorizontal = 'FIXED'
    frame.resize(200, 20)
    frame.primaryAxisAlignItems = 'SPACE_BETWEEN'
    layout()
    expect(xs(children)).toEqual([0, 80, 160])
  })

  test('a wrapped row keeps its siblings and rows apart', () => {
    const { frame, children, layout } = stack('HORIZONTAL', -6)
    frame.layoutWrap = 'WRAP'
    frame.counterAxisSpacing = -4
    frame.layoutSizingHorizontal = 'FIXED'
    frame.resize(100, 20)
    frame.layoutSizingVertical = 'HUG'
    layout()
    expect(xs(children)).toEqual([0, 40, 0])
    expect(ys(children)).toEqual([0, 0, 20])
    expect([frame.width, frame.height]).toEqual([100, 40])
  })

  test('positive spacing still separates siblings', () => {
    const { frame, children, layout } = stack('HORIZONTAL', 10)
    layout()
    expect(xs(children)).toEqual([0, 50, 100])
    expect(frame.width).toBe(140)
  })
})
