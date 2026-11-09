import { describe, expect, test } from 'bun:test'

import { createLinter, type LintMessage } from '@open-pencil/core/lint'
import { SceneGraph } from '@open-pencil/scene-graph'

function lint(graph: SceneGraph, rule: string): LintMessage[] {
  return createLinter({ rules: [rule], config: { rules: { [rule]: 'warning' } } }).lintGraph(graph)
    .messages
}

function gridItem(position: { column: number; row: number; columnSpan: number; rowSpan: number }) {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const grid = graph.createNode('FRAME', pageId, {
    name: 'Grid',
    layoutMode: 'GRID',
    width: 200,
    height: 200
  })
  const item = graph.createNode('RECTANGLE', grid.id, {
    name: 'Item',
    width: 40,
    height: 40,
    gridPosition: position
  })
  return { graph, item }
}

describe('invalid-grid-placement', () => {
  test('reports a placement layout cannot use and offers the placement it can', () => {
    const { graph, item } = gridItem({ column: 2, row: 0, columnSpan: 0, rowSpan: -1 })

    const messages = lint(graph, 'invalid-grid-placement')

    expect(messages).toHaveLength(1)
    expect(messages[0]?.nodeId).toBe(item.id)
    expect(messages[0]?.data).toEqual({ column: 2, row: 0, columnSpan: 0, rowSpan: -1 })
    expect(messages[0]?.fix).toEqual({
      kind: 'set-grid-placement',
      placement: { column: 2, row: 0, columnSpan: 1, rowSpan: 1 }
    })
  })

  test('reports a line or span past the bounds layout places', () => {
    const { graph } = gridItem({ column: 5000, row: 0, columnSpan: 1, rowSpan: 4000 })

    const messages = lint(graph, 'invalid-grid-placement')

    expect(messages).toHaveLength(1)
    expect(messages[0]?.fix).toEqual({
      kind: 'set-grid-placement',
      placement: { column: 1000, row: 0, columnSpan: 1, rowSpan: 1000 }
    })
  })

  test('accepts whole lines from zero, including auto placement, and spans of one', () => {
    const auto = gridItem({ column: 0, row: 0, columnSpan: 1, rowSpan: 1 })
    const placed = gridItem({ column: 3, row: 2, columnSpan: 2, rowSpan: 4 })

    expect(lint(auto.graph, 'invalid-grid-placement')).toEqual([])
    expect(lint(placed.graph, 'invalid-grid-placement')).toEqual([])
  })

  test('runs in Recommended and stays out of Accessibility', () => {
    const flagged = (preset: string) => {
      const { graph } = gridItem({ column: 1, row: 0, columnSpan: 0, rowSpan: 1 })
      return createLinter({ preset, rules: ['invalid-grid-placement'] }).lintGraph(graph).messages
    }

    expect(flagged('recommended')).toHaveLength(1)
    expect(flagged('accessibility')).toEqual([])
  })
})
