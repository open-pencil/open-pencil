import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

import { applyResize, cancelResizePreview, commitResizePreview } from '#vue/shared/input/resize'
import type { DragResize } from '#vue/shared/input/types'

function drag(node: SceneNode): DragResize {
  return {
    type: 'resize',
    handle: 'e',
    startX: node.width,
    startY: node.height / 2,
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

describe('resizing a frame read from a .fig file', () => {
  test('its Fill children fill the new size while dragging and after', () => {
    const editor = createEditor()
    try {
      const { graph } = editor
      const row = graph.createNode('FRAME', editor.state.currentPageId, {
        width: 200,
        height: 40,
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED',
        paddingLeft: 10,
        paddingRight: 10
      })
      const field = graph.createNode('FRAME', row.id, {
        x: 10,
        width: 180,
        height: 40,
        layoutGrow: 1
      })
      for (const node of [row, field]) {
        graph.applyImportedStateDuring(() =>
          graph.updateNode(node.id, {
            source: { ...node.source, format: 'fig', id: node.id },
            derivedLayout: { x: node.x, y: node.y, width: node.width, height: node.height }
          })
        )
      }
      editor.runLayoutForNode(row.id)

      const resize = drag(row)
      applyResize(resize, 300, 20, false, editor, true)
      expect([row.width, field.width]).toEqual([300, 280])
      commitResizePreview(resize, editor)
      expect([row.width, field.width]).toEqual([300, 280])
      editor.undoAction()
      expect([row.width, field.width]).toEqual([200, 180])
    } finally {
      editor.dispose()
    }
  })
})

describe('a resize that changes nothing', () => {
  test('leaves a layer read from a .fig file unedited, whether released or cancelled', () => {
    const editor = createEditor()
    try {
      const { graph } = editor
      const frame = graph.createNode('FRAME', editor.state.currentPageId, { width: 200, height: 40 })
      graph.applyImportedStateDuring(() =>
        graph.updateNode(frame.id, { source: { ...frame.source, format: 'fig', id: frame.id } })
      )
      const press = drag(frame)
      applyResize(press, 200, 20, false, editor, true)
      commitResizePreview(press, editor)
      expect(frame.source.editedFields).toEqual([])

      const cancelled = drag(frame)
      applyResize(cancelled, 260, 20, false, editor, true)
      expect(frame.width).toBe(260)
      cancelResizePreview(cancelled, editor)
      expect([frame.width, frame.source.editedFields]).toEqual([200, []])
    } finally {
      editor.dispose()
    }
  })
})

test('a cancelled resize gives a vector back its own geometry', () => {
  const editor = createEditor()
  try {
    const network = {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 50 }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: []
    }
    const vector = editor.graph.createNode('VECTOR', editor.state.currentPageId, {
      width: 100,
      height: 50,
      vectorNetwork: network
    })
    const resize = { ...drag(vector), origVectorNetwork: structuredClone(network) }
    applyResize(resize, 200, 25, false, editor, true)
    expect(vector.vectorNetwork?.vertices[1]?.x).toBe(200)
    cancelResizePreview(resize, editor)
    expect([vector.width, vector.vectorNetwork?.vertices[1]?.x]).toEqual([100, 100])
  } finally {
    editor.dispose()
  }
})
