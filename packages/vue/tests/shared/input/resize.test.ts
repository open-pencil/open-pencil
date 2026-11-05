import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import { hasInstanceOverride } from '@open-pencil/scene-graph/instances'
import Matrix from '@open-pencil/scene-graph/matrix'
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

test('a vector dragged back to its size keeps its own geometry', () => {
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
    // Out to twice the width, then back past the start and to it again, as a hand drags.
    applyResize(resize, 99, 25, false, editor, true)
    applyResize(resize, 100, 25, false, editor, true)
    expect(vector.vectorNetwork?.vertices[1]?.x).toBe(100)
  } finally {
    editor.dispose()
  }
})

test('a press on a handle that does not move keeps a layer’s imported geometry', () => {
  const editor = createEditor()
  try {
    const vector = editor.graph.createNode('VECTOR', editor.state.currentPageId, {
      width: 100,
      height: 50
    })
    editor.graph.applyImportedStateDuring(() => {
      vector.source.fig.rawNodeFields.vectorData = { imported: true }
    })
    commitResizePreview(drag(vector), editor)
    expect(vector.source.fig.rawNodeFields.vectorData).toEqual({ imported: true })
    expect(editor.undo.canUndo).toBe(false)
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

describe('resizing a layer inside a group', () => {
  test('the group fits its children again, and one undo puts both back', () => {
    const editor = createEditor()
    try {
      const page = editor.state.currentPageId
      const group = editor.graph.createNode('GROUP', page, { x: 0, y: 0, width: 150, height: 50 })
      editor.graph.createNode('RECTANGLE', group.id, { x: 0, y: 0, width: 50, height: 50 })
      const child = editor.graph.createNode('RECTANGLE', group.id, {
        x: 100,
        y: 0,
        width: 50,
        height: 50
      })
      const d = { ...drag(child), startX: 150, startY: 25 }
      applyResize(d, 250, 25, false, editor)
      commitResizePreview(d, editor)
      expect(editor.graph.getNode(group.id)?.width).toBe(250)

      editor.undo.undo()
      expect(editor.graph.getNode(group.id)?.width).toBe(150)
      expect(editor.graph.getNode(child.id)?.width).toBe(50)
    } finally {
      editor.dispose()
    }
  })
})

describe('resizing a turned layer', () => {
  /** A 100×50 layer turned 30°, with the canvas point of a spot on it and of a vector along it. */
  function turned() {
    const editor = createEditor()
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      x: 100,
      y: 100,
      width: 100,
      height: 50,
      rotation: 30
    })
    editor.select([node.id])
    const world = getWorldMatrix(node, editor.graph)
    const at = (x: number, y: number) => {
      const [px, py] = Matrix.mapPoints(world, [x, y])
      return { x: px, y: py }
    }
    const corners = () => {
      const current = editor.graph.getNode(node.id)
      if (!current) throw new Error('missing layer')
      const points = Matrix.mapPoints(getWorldMatrix(current, editor.graph), [
        0,
        0,
        0,
        current.height
      ])
      return points.map((value) => Math.round(value * 1e6) / 1e6)
    }
    // The right edge's handle, and a press that drags it from there.
    const handle = at(100, 25)
    const press = (): DragResize => ({
      ...drag(node),
      startX: handle.x,
      startY: handle.y
    })
    return { editor, node, at, corners, press }
  }

  test('its right handle stretches it along its own axis and its left edge stays put', () => {
    const { editor, node, at, corners, press } = turned()
    const leftEdge = corners()
    const resize = press()
    // 50 along the layer's own x axis, as Figma measures the drag.
    const target = at(150, 25)
    applyResize(resize, target.x, target.y, false, editor, true)
    commitResizePreview(resize, editor)
    expect(editor.graph.getNode(node.id)?.width).toBeCloseTo(150, 6)
    expect(editor.graph.getNode(node.id)?.rotation).toBe(30)
    expect(corners()).toEqual(leftEdge)
    editor.dispose()
  })

  test('dragged past its left edge it comes out mirrored, and one undo puts it back', () => {
    const { editor, node, at, corners, press } = turned()
    const leftEdge = corners()
    const resize = press()
    // 50 beyond the left edge: the layer flips over it, 50 wide, its own x axis now running back
    // from the edge it kept.
    const target = at(-50, 25)
    applyResize(resize, target.x, target.y, false, editor, true)
    commitResizePreview(resize, editor)
    const mirrored = editor.graph.getNode(node.id)
    if (!mirrored) throw new Error('missing layer')
    expect(mirrored.width).toBeCloseTo(50, 6)
    expect(corners()).toEqual(leftEdge)
    const [fx, fy] = Matrix.mapPoints(getWorldMatrix(mirrored, editor.graph), [mirrored.width, 0])
    const far = at(-50, 0)
    expect(fx).toBeCloseTo(far.x, 6)
    expect(fy).toBeCloseTo(far.y, 6)

    editor.undo.undo()
    expect(editor.graph.getNode(node.id)).toMatchObject({
      x: 100,
      y: 100,
      width: 100,
      rotation: 30,
      flipX: false,
      flipY: false
    })
    editor.dispose()
  })

  test('a cancelled mirror puts its angle and flips back', () => {
    const { editor, node, at, press } = turned()
    const resize = press()
    const target = at(-50, 25)
    applyResize(resize, target.x, target.y, false, editor, true)
    cancelResizePreview(resize, editor)
    expect(editor.graph.getNode(node.id)).toMatchObject({
      x: 100,
      width: 100,
      rotation: 30,
      flipX: false,
      flipY: false
    })
    editor.dispose()
  })
})
