import { describe, expect, test } from 'bun:test'

import { DEFAULT_SNAPPING_PREFERENCES, createEditor } from '@open-pencil/core/editor'

import type { DragEditNode } from '#vue/shared/input/types'
import { applyNodeEditSnap } from '#vue/shared/input/vector/snap'

function createDrag(startX: number, startY: number): DragEditNode {
  return {
    type: 'edit-node',
    startX,
    startY,
    origPositions: new Map([[0, { x: startX, y: startY }]])
  }
}

describe('vector edit snapping', () => {
  test('snaps a dragged vertex to sibling bounds and publishes a guide', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const vector = editor.graph.createNode('VECTOR', pageId, {
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      vectorNetwork: {
        vertices: [{ x: 10, y: 20 }],
        segments: [],
        regions: []
      }
    })
    editor.graph.createNode('RECTANGLE', pageId, {
      x: 100,
      y: 0,
      width: 100,
      height: 100
    })
    const editState = {
      nodeId: vector.id,
      vertices: [{ x: 10, y: 20 }],
      segments: [],
      selectedVertexIndices: new Set([0]),
      selectedHandles: new Set<number>(),
      hoveredHandleInfo: null
    }

    const snapped = applyNodeEditSnap(createDrag(10, 20), 87, 0, editor, editState)

    expect(snapped).toEqual({ x: 90, y: 0 })
    expect(editor.state.snapGuides).toContainEqual({
      axis: 'x',
      position: 100,
      from: 0,
      to: 100
    })
  })

  test('snaps a dragged vertex to another vertex in the edited network', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const vector = editor.graph.createNode('VECTOR', pageId, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      vectorNetwork: {
        vertices: [
          { x: 10, y: 20 },
          { x: 80, y: 60 }
        ],
        segments: [],
        regions: []
      }
    })
    const editState = {
      nodeId: vector.id,
      vertices: [
        { x: 10, y: 20 },
        { x: 80, y: 60 }
      ],
      segments: [],
      selectedVertexIndices: new Set([0]),
      selectedHandles: new Set<number>(),
      hoveredHandleInfo: null
    }

    const snapped = applyNodeEditSnap(createDrag(10, 20), 67, 37, editor, editState)

    expect(snapped).toEqual({ x: 70, y: 40 })
    expect(editor.state.snapGuides).toEqual(
      expect.arrayContaining([
        { kind: 'geometry', axis: 'x', position: 80, from: 60, to: 60 },
        { kind: 'geometry', axis: 'y', position: 60, from: 80, to: 80 }
      ])
    )
  })

  test('keeps the snap threshold constant in screen pixels across zoom levels', () => {
    const editor = createEditor()
    editor.state.zoom = 2
    const pageId = editor.state.currentPageId
    const vector = editor.graph.createNode('VECTOR', pageId, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      vectorNetwork: {
        vertices: [
          { x: 10, y: 20 },
          { x: 80, y: 60 }
        ],
        segments: [],
        regions: []
      }
    })
    const editState = {
      nodeId: vector.id,
      vertices: [
        { x: 10, y: 20 },
        { x: 80, y: 60 }
      ],
      segments: [],
      selectedVertexIndices: new Set([0]),
      selectedHandles: new Set<number>(),
      hoveredHandleInfo: null
    }

    const outsideScreenThreshold = applyNodeEditSnap(createDrag(10, 20), 67, 0, editor, editState)
    const insideScreenThreshold = applyNodeEditSnap(createDrag(10, 20), 68, 0, editor, editState)

    expect(outsideScreenThreshold.x).toBe(67)
    expect(insideScreenThreshold.x).toBe(70)
  })

  test('respects independent geometry and object preferences', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const vector = editor.graph.createNode('VECTOR', pageId, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      vectorNetwork: {
        vertices: [
          { x: 10, y: 20 },
          { x: 80, y: 60 }
        ],
        segments: [],
        regions: []
      }
    })
    editor.graph.createNode('RECTANGLE', pageId, { x: 100, y: 0, width: 100, height: 100 })
    const editState = {
      nodeId: vector.id,
      vertices: [
        { x: 10, y: 20 },
        { x: 80, y: 60 }
      ],
      segments: [],
      selectedVertexIndices: new Set([0]),
      selectedHandles: new Set<number>(),
      hoveredHandleInfo: null
    }

    editor.state.snappingPreferences = {
      ...DEFAULT_SNAPPING_PREFERENCES,
      objects: false
    }
    expect(applyNodeEditSnap(createDrag(10, 20), 87, 0, editor, editState).x).toBe(87)

    editor.state.snappingPreferences = {
      geometry: false,
      objects: true,
      pixelGrid: false
    }
    expect(applyNodeEditSnap(createDrag(10, 20), 67, 37, editor, editState)).toEqual({
      x: 67,
      y: 37
    })
  })

  test('snaps vector points to whole-pixel coordinates', () => {
    const editor = createEditor()
    editor.state.snappingPreferences = { geometry: false, objects: false, pixelGrid: true }
    const pageId = editor.state.currentPageId
    const vector = editor.graph.createNode('VECTOR', pageId, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      vectorNetwork: { vertices: [{ x: 10.2, y: 20.4 }], segments: [], regions: [] }
    })
    const editState = {
      nodeId: vector.id,
      vertices: [{ x: 10.2, y: 20.4 }],
      segments: [],
      selectedVertexIndices: new Set([0]),
      selectedHandles: new Set<number>(),
      hoveredHandleInfo: null
    }

    const snapped = applyNodeEditSnap(createDrag(10.2, 20.4), 2.2, 3.3, editor, editState)

    expect(snapped.x).toBeCloseTo(1.8)
    expect(snapped.y).toBeCloseTo(3.6)
    expect(editor.state.snapGuides.map((guide) => guide.axis).sort()).toEqual(['x', 'y'])
  })
})
