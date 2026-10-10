import { describe, expect, test } from 'bun:test'

import { FigmaAPI, type FigmaNodeProxy } from '#core/figma-api'
import { computeAllLayouts } from '#core/layout'
import { SceneGraph } from '@open-pencil/scene-graph'

/** A Hug row with padding and gap 10 around a 60 × 40 and a 50 × 30 rectangle. */
function hugRow() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const layout = () => computeAllLayouts(graph, graph.getPages()[0].id)
  const row = figma.createFrame()
  row.layoutMode = 'HORIZONTAL'
  row.paddingLeft = row.paddingRight = row.paddingTop = row.paddingBottom = 10
  row.itemSpacing = 10
  const first = figma.createRectangle()
  first.resize(60, 40)
  row.appendChild(first)
  const child = figma.createRectangle()
  child.resize(50, 30)
  row.appendChild(child)
  row.layoutSizingHorizontal = 'HUG'
  row.layoutSizingVertical = 'HUG'
  layout()
  return { row, child, layout }
}

// Sizes read from Figma desktop 126's plugin API with the same layers.
describe('Fill inside a Hug parent keeps sizes as Figma does', () => {
  test('a child set to Fill along a Hug axis keeps its width', () => {
    const { row, child, layout } = hugRow()
    child.layoutSizingHorizontal = 'FILL'
    layout()
    expect([row.width, child.width]).toEqual([140, 50])
  })

  test('a parent set to Hug keeps the width its Fill child had', () => {
    const { row, child, layout } = hugRow()
    row.layoutSizingHorizontal = 'FIXED'
    row.resize(320, row.height)
    child.layoutSizingHorizontal = 'FILL'
    layout()
    expect(child.width).toBe(230)
    row.layoutSizingHorizontal = 'HUG'
    layout()
    expect([row.width, child.width]).toEqual([320, 230])
  })

  test('Fill across a Hug axis stretches to the tallest sibling', () => {
    const { row, child, layout } = hugRow()
    child.layoutSizingVertical = 'FILL'
    layout()
    expect([row.height, child.height]).toEqual([60, 40])

    row.layoutSizingVertical = 'FIXED'
    row.resize(row.width, 100)
    layout()
    expect(child.height).toBe(80)
    row.layoutSizingVertical = 'HUG'
    layout()
    expect([row.height, child.height]).toEqual([60, 40])
  })
})

describe('when every child fills across a Hug axis', () => {
  function column(children: (figma: FigmaAPI) => FigmaNodeProxy[]) {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    const layout = () => computeAllLayouts(graph, graph.getPages()[0].id)
    const parent = figma.createFrame()
    parent.layoutMode = 'VERTICAL'
    parent.layoutSizingHorizontal = 'HUG'
    parent.layoutSizingVertical = 'HUG'
    const nodes = children(figma)
    for (const node of nodes) parent.appendChild(node)
    layout()
    return { parent, nodes, layout }
  }

  test('layers without content of their own keep the width the parent had', () => {
    const { parent, nodes, layout } = column((figma) =>
      [100, 140].map((width) => {
        const frame = figma.createFrame()
        frame.resize(width, 30)
        return frame
      })
    )
    for (const node of nodes) node.layoutSizingHorizontal = 'FILL'
    layout()
    expect([parent.width, ...nodes.map((node) => node.width)]).toEqual([140, 140, 140])
  })

  test('a fixed sibling sets the width again', () => {
    const { parent, nodes, layout } = column((figma) =>
      [100, 140].map((width) => {
        const frame = figma.createFrame()
        frame.resize(width, 30)
        return frame
      })
    )
    nodes[0].layoutSizingHorizontal = 'FILL'
    nodes[1].resize(60, 30)
    layout()
    expect([parent.width, ...nodes.map((node) => node.width)]).toEqual([60, 60, 60])
  })

  test('an auto layout child counts with its content, not its old width', () => {
    const { parent, nodes, layout } = column((figma) => {
      const fixed = figma.createFrame()
      fixed.resize(60, 30)
      const filled = figma.createFrame()
      filled.layoutMode = 'HORIZONTAL'
      filled.layoutSizingHorizontal = 'FIXED'
      filled.layoutSizingVertical = 'FIXED'
      filled.resize(200, 30)
      return [fixed, filled]
    })
    nodes[1].layoutSizingHorizontal = 'FILL'
    layout()
    expect([parent.width, nodes[1].width]).toEqual([60, 60])
  })
})
