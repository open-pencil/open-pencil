import { describe, expect, test } from 'bun:test'

import { autoFrame, pageId, rect } from '#core-tests/helpers/layout'

import { computeLayout } from '@open-pencil/core/layout'
import { SceneGraph } from '@open-pencil/scene-graph'
import { getNodeOrThrow } from '@open-pencil/test-support/assert'

describe('min/max constraints', () => {
  test('maxWidth clamps child in horizontal layout', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 100
    })
    rect(graph, frame.id, 50, 50, { layoutGrow: 1, maxWidth: 200 })

    computeLayout(graph, frame.id)

    const child = graph.getChildren(frame.id)[0]
    expect(child.width).toBe(200)
  })

  test('minWidth prevents shrinking below minimum', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 100,
      height: 100
    })
    rect(graph, frame.id, 200, 50, { minWidth: 150 })

    computeLayout(graph, frame.id)

    const child = graph.getChildren(frame.id)[0]
    expect(child.width).toBeGreaterThanOrEqual(150)
  })

  test('maxHeight clamps child in vertical layout', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      layoutMode: 'VERTICAL',
      width: 200,
      height: 400
    })
    rect(graph, frame.id, 50, 50, { layoutGrow: 1, maxHeight: 150 })

    computeLayout(graph, frame.id)

    const child = graph.getChildren(frame.id)[0]
    expect(child.height).toBe(150)
  })

  test('minHeight enforces minimum in vertical layout', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      layoutMode: 'VERTICAL',
      width: 200,
      height: 400
    })
    rect(graph, frame.id, 50, 30, { minHeight: 80 })

    computeLayout(graph, frame.id)

    const child = graph.getChildren(frame.id)[0]
    expect(child.height).toBe(80)
  })

  test('min/max on nested auto-layout frame', () => {
    const graph = new SceneGraph()
    const outer = autoFrame(graph, pageId(graph), {
      width: 500,
      height: 200
    })
    const inner = autoFrame(graph, outer.id, {
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      width: 50,
      height: 50,
      layoutGrow: 1,
      maxWidth: 250
    })
    rect(graph, inner.id, 30, 30)

    computeLayout(graph, outer.id)

    const innerNode = getNodeOrThrow(graph, inner.id)
    expect(innerNode.width).toBe(250)
  })
  // Measured in Figma: a 600 px column puts a Fill child capped at 300 px at 0, 150, and 300.
  test('a fill capped by its maximum width sits where the parent aligns its children', () => {
    for (const [align, x] of [
      ['MIN', 0],
      ['CENTER', 150],
      ['MAX', 300]
    ] as const) {
      const graph = new SceneGraph()
      const column = autoFrame(graph, pageId(graph), {
        layoutMode: 'VERTICAL',
        counterAxisAlign: align,
        width: 600,
        height: 100
      })
      const leaf = rect(graph, column.id, 50, 20, { layoutAlignSelf: 'STRETCH', maxWidth: 300 })
      const box = autoFrame(graph, column.id, {
        layoutMode: 'VERTICAL',
        counterAxisSizing: 'FIXED',
        layoutAlignSelf: 'STRETCH',
        maxWidth: 300,
        width: 50,
        height: 20
      })

      computeLayout(graph, column.id)

      for (const child of [leaf, box]) {
        expect(getNodeOrThrow(graph, child.id)).toMatchObject({ x, width: 300 })
      }
    }
  })
})
