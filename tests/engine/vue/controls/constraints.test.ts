import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import type { ConstraintType } from '@open-pencil/scene-graph'
import {
  collectResizeDescendants,
  constrainedChildRect,
  type ResizeSnapshot
} from '@open-pencil/scene-graph/resize'
import { constraintPins, isConstraintEligible, toggleConstraintPin } from '@open-pencil/vue'

import { applyResize } from '#vue/shared/input/resize'
import type { DragResize } from '#vue/shared/input/types'

import { createRect, firstPageId, makeSceneGraph } from '#tests/helpers/scene'

function original(node: {
  x: number
  y: number
  width: number
  height: number
  vectorNetwork: ResizeSnapshot['vectorNetwork']
}): ResizeSnapshot {
  return {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    vectorNetwork: node.vectorNetwork
  }
}

describe('constraint control model', () => {
  test('limits constraints to eligible frame children', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const topLevel = createRect(graph, pageId)
    const frame = graph.createNode('FRAME', pageId, { layoutMode: 'NONE' })
    const child = createRect(graph, frame.id)
    const group = graph.createNode('GROUP', frame.id)
    expect(isConstraintEligible(graph, topLevel)).toBe(false)
    expect(isConstraintEligible(graph, child)).toBe(true)
    expect(isConstraintEligible(graph, group)).toBe(false)

    graph.updateNode(frame.id, { layoutMode: 'HORIZONTAL' })
    expect(isConstraintEligible(graph, child)).toBe(false)
    graph.updateNode(child.id, { layoutPositioning: 'ABSOLUTE' })
    expect(isConstraintEligible(graph, child)).toBe(true)
  })

  test('maps edge pins and additive pin toggles', () => {
    expect(constraintPins('STRETCH')).toMatchObject({ leading: true, trailing: true })
    expect(toggleConstraintPin('MAX', 'leading', false)).toBe('MIN')
    expect(toggleConstraintPin('MAX', 'leading', true)).toBe('STRETCH')
    expect(toggleConstraintPin('STRETCH', 'leading', true)).toBe('MAX')
    expect(toggleConstraintPin('MIN', 'leading', true)).toBe('CENTER')
  })
})

describe('constraint resize geometry', () => {
  const child: ResizeSnapshot = {
    x: 20,
    y: 30,
    width: 40,
    height: 20,
    vectorNetwork: null
  }
  const expectedX: Record<ConstraintType, [number, number]> = {
    MIN: [20, 40],
    CENTER: [70, 40],
    MAX: [120, 40],
    STRETCH: [20, 140],
    SCALE: [40, 80]
  }

  for (const constraint of Object.keys(expectedX) as ConstraintType[]) {
    test(`applies ${constraint} on one axis`, () => {
      const rect = constrainedChildRect(
        child,
        { width: 100, height: 100 },
        { width: 200, height: 100 },
        constraint,
        'MIN'
      )
      expect([rect.x, rect.width]).toEqual(expectedX[constraint])
      expect([rect.y, rect.height]).toEqual([30, 20])
    })
  }

  test('recurses through constrained nested frames during resize preview', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const root = graph.createNode('FRAME', pageId, { width: 100, height: 100 })
    const nested = graph.createNode('FRAME', root.id, {
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      horizontalConstraint: 'STRETCH'
    })
    const grandchild = graph.createNode('RECTANGLE', nested.id, {
      x: 30,
      y: 10,
      width: 10,
      height: 10,
      horizontalConstraint: 'MAX'
    })
    const editor = createEditor({ graph })
    const drag: DragResize = {
      type: 'resize',
      handle: 'se',
      startX: 100,
      startY: 100,
      origRect: { x: root.x, y: root.y, width: root.width, height: root.height },
      nodeId: root.id,
      origVectorNetwork: null,
      origChildren: new Map([
        [nested.id, original(nested)],
        [grandchild.id, original(grandchild)]
      ])
    }

    applyResize(drag, 200, 100, false, editor)

    expect(graph.getNode(nested.id)).toMatchObject({ x: 10, width: 150 })
    expect(graph.getNode(grandchild.id)).toMatchObject({ x: 130, width: 10 })
  })

  test('repositions constrained descendants after an in-flow child grows in resize preview', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const root = graph.createNode('FRAME', pageId, {
      width: 100,
      height: 100,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    })
    const nested = graph.createNode('FRAME', root.id, {
      width: 100,
      height: 100,
      layoutGrow: 1
    })
    const grandchild = graph.createNode('RECTANGLE', nested.id, {
      x: 80,
      y: 0,
      width: 10,
      height: 10,
      horizontalConstraint: 'MAX'
    })
    const editor = createEditor({ graph })
    const drag: DragResize = {
      type: 'resize',
      handle: 'e',
      startX: 100,
      startY: 50,
      origRect: { x: root.x, y: root.y, width: root.width, height: root.height },
      nodeId: root.id,
      origVectorNetwork: null,
      origChildren: collectResizeDescendants(graph, root.id)
    }

    applyResize(drag, 200, 50, false, editor)

    expect(graph.getNode(nested.id)?.width).toBe(200)
    expect(graph.getNode(grandchild.id)?.x).toBe(180)
  })
})
