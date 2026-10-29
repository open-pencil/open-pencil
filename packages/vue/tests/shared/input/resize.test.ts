import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import { hasInstanceOverride } from '@open-pencil/scene-graph/instances'
import { createResizeSnapshot } from '@open-pencil/scene-graph/resize'

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
      const frame = graph.createNode('FRAME', editor.state.currentPageId, {
        width: 200,
        height: 40
      })
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
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
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

describe('resizing an instance', () => {
  test('places its layers by their constraints without making their sizes overrides', () => {
    // Repeats a Figma desktop 126 script: an instance resized to twice its component's size
    // claims only its own size, so a later component edit still sizes its layers.
    const editor = createEditor()
    try {
      const { graph } = editor
      const page = editor.state.currentPageId
      const card = graph.createNode('COMPONENT', page, {
        width: 140,
        height: 140,
        strokes: [
          {
            type: 'SOLID',
            color: { r: 0, g: 0, b: 0, a: 1 },
            opacity: 1,
            visible: true,
            weight: 1,
            align: 'INSIDE'
          }
        ]
      })
      const box = graph.createNode('RECTANGLE', card.id, {
        x: 20,
        y: 20,
        width: 100,
        height: 100,
        horizontalConstraint: 'SCALE',
        verticalConstraint: 'SCALE'
      })
      const instance = graph.createInstance(card.id, page, { x: 300 })
      if (!instance) throw new Error('Expected an instance')
      const [copy] = graph.getChildren(instance.id)
      const resize: DragResize = {
        ...drag(instance),
        handle: 'se',
        startX: instance.x + instance.width,
        startY: instance.y + instance.height,
        origChildren: new Map([[copy.id, createResizeSnapshot(copy)]])
      }
      applyResize(resize, instance.x + 280, instance.y + 280, false, editor, true)
      commitResizePreview(resize, editor)
      expect([instance.width, instance.height, copy.width, copy.height]).toEqual([
        280, 280, 200, 200
      ])
      expect(hasInstanceOverride(graph, instance.id, 'width')).toBe(true)
      expect(hasInstanceOverride(graph, copy.id, 'width')).toBe(false)
      // A corner drag leaves the instance in place, and resizes no strokes of its own.
      expect(
        (['x', 'y', 'strokes'] as const).map((field) =>
          hasInstanceOverride(graph, instance.id, field)
        )
      ).toEqual([false, false, false])

      graph.updateNode(box.id, { width: 115 })
      graph.syncInstances(card.id)
      expect(copy.width).toBe(230)
    } finally {
      editor.dispose()
    }
  })
})
