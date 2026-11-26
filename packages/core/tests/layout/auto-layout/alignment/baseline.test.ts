import { describe, expect, test } from 'bun:test'

import { autoFrame, pageId, rect } from '#core-tests/helpers/layout'

import { computeLayout, withTextBaselineMeasurer } from '@open-pencil/core/layout'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

// Inter's first baselines at 32 px and 12 px with automatic line heights, as the canvas draws them.
const BASELINES: Record<string, number> = { Big: 31, Small: 12 }

function text(graph: SceneGraph, parentId: string, name: string, width: number, height: number) {
  return graph.createNode('TEXT', parentId, {
    name,
    text: name,
    width,
    height,
    textAutoResize: 'WIDTH_AND_HEIGHT'
  })
}

function layOut(graph: SceneGraph, frame: SceneNode) {
  withTextBaselineMeasurer(
    (node) => BASELINES[node.name],
    () => computeLayout(graph, frame.id)
  )
  return (name: string) => graph.getChildren(frame.id).find((child) => child.name === name)
}

describe('alignment - baseline', () => {
  test('a row aligns text by its first baseline and a box by its bottom edge, as Figma does', () => {
    const graph = new SceneGraph()
    const row = autoFrame(graph, pageId(graph), { counterAxisAlign: 'BASELINE', itemSpacing: 8 })
    text(graph, row.id, 'Big', 48, 39)
    text(graph, row.id, 'Small', 30, 15)
    rect(graph, row.id, 20, 20)
    const child = layOut(graph, row)
    expect(child('Small')?.y).toBe(19)
    expect(graph.getChildren(row.id)[2].y).toBe(11)
  })

  test('a frame holding text aligns by that text’s baseline', () => {
    const graph = new SceneGraph()
    const row = autoFrame(graph, pageId(graph), { counterAxisAlign: 'BASELINE', itemSpacing: 8 })
    text(graph, row.id, 'Big', 48, 39)
    const inner = autoFrame(graph, row.id, {
      name: 'Inner',
      layoutMode: 'VERTICAL',
      paddingTop: 10,
      paddingBottom: 10
    })
    text(graph, inner.id, 'Small', 30, 15)
    const child = layOut(graph, row)
    expect(child('Inner')?.y).toBe(9)
  })

  test('without a measurer, text aligns by its bottom edge', () => {
    const graph = new SceneGraph()
    const row = autoFrame(graph, pageId(graph), { counterAxisAlign: 'BASELINE' })
    text(graph, row.id, 'Big', 48, 39)
    text(graph, row.id, 'Small', 30, 15)
    computeLayout(graph, row.id)
    expect(graph.getChildren(row.id)[1].y).toBe(24)
  })
})
