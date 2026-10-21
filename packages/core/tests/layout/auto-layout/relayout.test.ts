import { describe, expect, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { computeAllLayouts, computeLayout } from '#core/layout'

type Constraint = SceneNode['horizontalConstraint']

const HUG = { primaryAxisSizing: 'HUG', counterAxisSizing: 'HUG' } as const

function hugFrame(graph: SceneGraph, parentId: string) {
  return graph.createNode('FRAME', parentId, {
    layoutMode: 'HORIZONTAL',
    ...HUG,
    width: 100,
    height: 50
  })
}

function buttonInRow(
  constraint: Constraint = 'SCALE',
  badgeType: 'RECTANGLE' | 'FRAME' = 'RECTANGLE'
) {
  const graph = new SceneGraph()
  const row = hugFrame(graph, graph.getPages()[0].id)
  const button = hugFrame(graph, row.id)
  const label = graph.createNode('RECTANGLE', button.id, { width: 100, height: 50 })
  const badge = graph.createNode(badgeType, button.id, {
    x: 10,
    y: 10,
    width: 80,
    height: 30,
    layoutPositioning: 'ABSOLUTE',
    horizontalConstraint: constraint,
    verticalConstraint: constraint
  })
  computeAllLayouts(graph)
  return { graph, row, button, label, badge }
}

function layOutTimes(graph: SceneGraph, id: string, times: number) {
  for (let pass = 0; pass < times; pass++) {
    computeLayout(graph, id)
  }
}

function rect(node: SceneNode) {
  return [node.x, node.y, node.width, node.height]
}

describe('a Hug frame laid out with its parent moves its constrained layers once', () => {
  for (const [name, times] of [
    ['once', 1],
    ['twice', 2],
    ['three times', 3]
  ] as const) {
    test(`laid out ${name}`, () => {
      const { graph, row, button, label, badge } = buttonInRow()
      graph.updateNode(label.id, { width: 60, height: 30 })
      layOutTimes(graph, row.id, times)
      expect([button.width, button.height]).toEqual([60, 30])
      expect(rect(badge)).toEqual([6, 6, 48, 18])
    })
  }

  const EXPECTED: [Constraint, number[]][] = [
    ['SCALE', [6, 6, 48, 18]],
    ['MAX', [-30, -10, 80, 30]],
    ['CENTER', [-10, 0, 80, 30]],
    ['STRETCH', [10, 10, 40, 10]],
    ['MIN', [10, 10, 80, 30]]
  ]
  for (const [constraint, expected] of EXPECTED) {
    test(`${constraint} on both axes`, () => {
      const { graph, row, label, badge } = buttonInRow(constraint)
      graph.updateNode(label.id, { width: 60, height: 30 })
      layOutTimes(graph, row.id, 2)
      expect(rect(badge)).toEqual(expected)
    })
  }

  test('a layer inside a frame without auto layout follows that frame once', () => {
    const { graph, row, label, badge } = buttonInRow('STRETCH', 'FRAME')
    const dot = graph.createNode('RECTANGLE', badge.id, {
      x: 8,
      y: 0,
      width: 64,
      height: 30,
      horizontalConstraint: 'SCALE',
      verticalConstraint: 'MAX'
    })
    graph.updateNode(label.id, { width: 60, height: 30 })
    layOutTimes(graph, row.id, 2)
    expect(rect(badge)).toEqual([10, 10, 40, 10])
    expect(rect(dot)).toEqual([4, -20, 32, 30])
  })

  test('a Hug frame inside a Hug frame', () => {
    const graph = new SceneGraph()
    const row = hugFrame(graph, graph.getPages()[0].id)
    const button = hugFrame(graph, row.id)
    const inner = hugFrame(graph, button.id)
    const label = graph.createNode('RECTANGLE', inner.id, { width: 100, height: 50 })
    const badge = graph.createNode('RECTANGLE', inner.id, {
      x: 10,
      width: 80,
      height: 30,
      layoutPositioning: 'ABSOLUTE',
      horizontalConstraint: 'SCALE'
    })
    computeAllLayouts(graph)
    graph.updateNode(label.id, { width: 60 })
    layOutTimes(graph, row.id, 3)
    expect([button.width, inner.width]).toEqual([60, 60])
    expect([badge.x, badge.width]).toEqual([6, 48])
  })
})

test('laying a tree out again changes nothing', () => {
  function shrunkTree() {
    const tree = buttonInRow()
    tree.graph.updateNode(tree.label.id, { width: 60, height: 30 })
    return tree
  }
  function geometry(graph: SceneGraph) {
    return graph.flattenTree(graph.getPages()[0].id).map(({ node }) => rect(node))
  }

  const once = shrunkTree()
  computeAllLayouts(once.graph)
  const expected = geometry(once.graph)

  const twice = shrunkTree()
  computeAllLayouts(twice.graph)
  computeAllLayouts(twice.graph)
  expect(geometry(twice.graph)).toEqual(expected)

  const fromRoot = shrunkTree()
  layOutTimes(fromRoot.graph, fromRoot.row.id, 2)
  expect(geometry(fromRoot.graph)).toEqual(expected)
})
