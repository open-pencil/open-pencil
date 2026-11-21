import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import type { HandlePosition } from '@open-pencil/core/geometry'
import type { SceneNode } from '@open-pencil/scene-graph'

import { applyResize } from '#vue/shared/input/resize/apply'
import { resizedFromCenter } from '#vue/shared/input/resize/center'
import type { DragResize } from '#vue/shared/input/types'

const BOX = { x: 100, y: 100, width: 200, height: 100 }

describe('resizing from the center', () => {
  test('the side opposite the handle mirrors the one dragged', () => {
    const right = { ...BOX, width: 240 }
    expect(resizedFromCenter('e', BOX, right, null)).toEqual({
      x: 60,
      y: 100,
      width: 280,
      height: 100
    })

    const top = { ...BOX, y: 80, height: 120 }
    expect(resizedFromCenter('n', BOX, top, null)).toEqual({
      x: 100,
      y: 80,
      width: 200,
      height: 140
    })
  })

  test('a corner keeps the center on both axes', () => {
    const corner = { x: 90, y: 90, width: 210, height: 110 }
    expect(resizedFromCenter('nw', BOX, corner, null)).toEqual({
      x: 90,
      y: 90,
      width: 220,
      height: 120
    })
  })

  test('an edge kept at its ratio sizes the other axis around the center', () => {
    const wider = { x: 100, y: 90, width: 240, height: 120 }
    expect(resizedFromCenter('e', BOX, wider, 2)).toEqual({
      x: 60,
      y: 80,
      width: 280,
      height: 140
    })
  })

  test('a side dragged past the center leaves the box mirrored', () => {
    const past = { ...BOX, width: 60 }
    const { x, width } = resizedFromCenter('e', BOX, past, null)
    expect(width).toBe(-80)
    expect(x + width).toBe(160)
  })
})

function resizeDrag(node: SceneNode, handle: HandlePosition): DragResize {
  return {
    type: 'resize',
    handle,
    startX: node.x + node.width,
    startY: node.y + node.height / 2,
    origRect: { x: node.x, y: node.y, width: node.width, height: node.height },
    nodeId: node.id,
    origVectorNetwork: null,
    origFillGeometry: [],
    origStrokeGeometry: [],
    origDerivedTextGlyphs: null,
    origStrokes: [],
    origTextPathData: null,
    origTextPathBox: null,
    lockedAspectRatio: null,
    origChildren: null
  }
}

describe('Alt while resizing a layer', () => {
  test('grows the layer on both sides around its center', () => {
    const editor = createEditor()
    try {
      const rect = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, BOX)
      const drag = resizeDrag(rect, 'e')
      applyResize(drag, drag.startX + 30, drag.startY, false, editor, true, true)
      const node = editor.graph.getNode(rect.id)
      expect(node && [node.x, node.width]).toEqual([70, 260])
    } finally {
      editor.dispose()
    }
  })

  test('without Alt keeps the opposite side in place', () => {
    const editor = createEditor()
    try {
      const rect = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, BOX)
      const drag = resizeDrag(rect, 'e')
      applyResize(drag, drag.startX + 30, drag.startY, false, editor, true)
      const node = editor.graph.getNode(rect.id)
      expect(node && [node.x, node.width]).toEqual([100, 230])
    } finally {
      editor.dispose()
    }
  })
})
