import { describe, expect, test } from 'bun:test'

import { computeAutoLayoutIndicatorForFrame } from '#vue/shared/input/auto-layout'
import { handleMoveUp } from '#vue/shared/input/move'

import { SceneGraph, computeLayout } from '@open-pencil/core'
import { createEditor } from '@open-pencil/core/editor'

import type { DragMove } from '#vue/shared/input/types'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

describe('RTL auto-layout input', () => {
  test('computes insertion index by RTL visual order', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      layoutMode: 'HORIZONTAL',
      layoutDirection: 'RTL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      width: 300,
      height: 80,
      paddingRight: 30,
      itemSpacing: 10
    })
    graph.createNode('RECTANGLE', frame.id, { width: 50, height: 30, name: 'A' })
    graph.createNode('RECTANGLE', frame.id, { width: 60, height: 30, name: 'B' })

    computeLayout(graph, frame.id)

    const editor = createEditor({ graph })
    computeAutoLayoutIndicatorForFrame(frame, 215, 40, editor)

    expect(editor.state.layoutInsertIndicator?.index).toBe(1)
    expect(editor.state.layoutInsertIndicator?.x).toBe(215)
  })

  test('does not reorder on click-sized movement inside auto-layout', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      layoutMode: 'HORIZONTAL',
      layoutDirection: 'RTL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      width: 300,
      height: 80,
      paddingRight: 30,
      itemSpacing: 10
    })
    const first = graph.createNode('RECTANGLE', frame.id, { width: 50, height: 30, name: 'First' })
    const second = graph.createNode('RECTANGLE', frame.id, {
      width: 60,
      height: 30,
      name: 'Second'
    })

    computeLayout(graph, frame.id)

    const editor = createEditor({ graph })
    editor.select([second.id])
    editor.setLayoutInsertIndicator({
      parentId: frame.id,
      index: 0,
      x: 0,
      y: 0,
      length: 0,
      direction: 'VERTICAL'
    })

    const drag: DragMove = {
      type: 'move',
      startX: 100,
      startY: 40,
      currentX: 100,
      currentY: 40,
      originals: new Map([[second.id, { x: second.x, y: second.y, parentId: frame.id }]]),
      autoLayoutParentId: frame.id
    }

    handleMoveUp(drag, editor)

    expect(graph.getChildren(frame.id).map((child) => child.id)).toEqual([first.id, second.id])
  })
})
