import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { computeLayout } from '@open-pencil/core/layout'

import { getNodeOrThrow } from '#tests/helpers/assert'

const PHONE_PRESET = { name: 'iPhone Air', width: 420, height: 912 }
const DESKTOP_PRESET = { name: 'Desktop', width: 1440, height: 1024 }

describe('frame presets', () => {
  test('creates a named frame at the viewport center and supports undo and redo', () => {
    const editor = createEditor({ getViewportSize: () => ({ width: 1000, height: 800 }) })
    editor.state.panX = 100
    editor.state.panY = 50
    editor.state.zoom = 2
    const previousId = editor.createShape('RECTANGLE', 10, 20, 30, 40)
    editor.select([previousId])
    editor.setTool('FRAME')

    const id = editor.createFrameFromPreset(PHONE_PRESET)
    const frame = getNodeOrThrow(editor.graph, id)

    expect(frame).toMatchObject({
      type: 'FRAME',
      name: 'iPhone Air',
      x: -10,
      y: -281,
      width: 420,
      height: 912,
      parentId: editor.state.currentPageId
    })
    expect(editor.state.selectedIds).toEqual(new Set([id]))
    expect(editor.state.activeTool).toBe('SELECT')

    editor.undo.undo()
    expect(editor.graph.getNode(id)).toBeUndefined()
    expect(editor.state.selectedIds).toEqual(new Set([previousId]))

    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, id)).toMatchObject({
      name: 'iPhone Air',
      width: 420,
      height: 912
    })
    expect(editor.state.selectedIds).toEqual(new Set([id]))
  })

  test('resizes a frame without renaming it and supports undo and redo', () => {
    const editor = createEditor()
    const id = editor.createFrameFromPreset(PHONE_PRESET)
    editor.graph.updateNode(id, {
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      layoutGrow: 1,
      layoutAlignSelf: 'STRETCH'
    })
    const nestedId = editor.graph.createNode('FRAME', id, {
      x: 20,
      y: 30,
      width: 100,
      height: 80,
      horizontalConstraint: 'STRETCH'
    }).id
    const grandchildId = editor.graph.createNode('RECTANGLE', nestedId, {
      x: 10,
      y: 15,
      width: 20,
      height: 25,
      horizontalConstraint: 'MAX'
    }).id

    editor.resizeFrameToPreset(id, DESKTOP_PRESET)
    expect(getNodeOrThrow(editor.graph, id)).toMatchObject({
      name: 'iPhone Air',
      width: 1440,
      height: 1024,
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      layoutGrow: 0,
      layoutAlignSelf: 'MIN'
    })
    expect(getNodeOrThrow(editor.graph, nestedId)).toMatchObject({ x: 20, width: 1120 })
    expect(getNodeOrThrow(editor.graph, grandchildId)).toMatchObject({ x: 1030, width: 20 })

    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, id)).toMatchObject({
      name: 'iPhone Air',
      width: 420,
      height: 912,
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      layoutGrow: 1,
      layoutAlignSelf: 'STRETCH'
    })
    expect(getNodeOrThrow(editor.graph, nestedId)).toMatchObject({ x: 20, width: 100 })
    expect(getNodeOrThrow(editor.graph, grandchildId)).toMatchObject({ x: 10, width: 20 })

    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, id)).toMatchObject({
      name: 'iPhone Air',
      width: 1440,
      height: 1024
    })
    expect(getNodeOrThrow(editor.graph, nestedId)).toMatchObject({ x: 20, width: 1120 })
    expect(getNodeOrThrow(editor.graph, grandchildId)).toMatchObject({ x: 1030, width: 20 })
  })

  test('keeps exact preset dimensions inside a stretching auto-layout parent', () => {
    const editor = createEditor()
    const parentId = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      width: 500,
      height: 500,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      counterAxisAlign: 'STRETCH'
    }).id
    const id = editor.graph.createNode('FRAME', parentId, {
      width: 100,
      height: 100,
      layoutAlignSelf: 'AUTO'
    }).id
    computeLayout(editor.graph, parentId)
    expect(getNodeOrThrow(editor.graph, id).height).toBe(500)

    editor.resizeFrameToPreset(id, { name: 'Custom', width: 200, height: 300 })
    expect(getNodeOrThrow(editor.graph, id)).toMatchObject({
      width: 200,
      height: 300,
      layoutAlignSelf: 'MIN'
    })

    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, id)).toMatchObject({
      width: 100,
      height: 500,
      layoutAlignSelf: 'AUTO'
    })

    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, id)).toMatchObject({
      width: 200,
      height: 300,
      layoutAlignSelf: 'MIN'
    })
  })

  test('keeps exact preset dimensions for an auto-layout frame inside a grid', () => {
    const editor = createEditor()
    const parentId = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      width: 500,
      height: 500,
      layoutMode: 'GRID',
      gridTemplateColumns: [{ sizing: 'FR', value: 1 }],
      gridTemplateRows: [{ sizing: 'FR', value: 1 }]
    }).id
    const id = editor.graph.createNode('FRAME', parentId, {
      width: 100,
      height: 100,
      layoutMode: 'HORIZONTAL',
      layoutAlignSelf: 'AUTO'
    }).id
    computeLayout(editor.graph, parentId)
    expect(getNodeOrThrow(editor.graph, id).width).toBe(500)

    editor.resizeFrameToPreset(id, { name: 'Custom', width: 200, height: 300 })
    expect(getNodeOrThrow(editor.graph, id)).toMatchObject({
      width: 200,
      height: 300,
      layoutAlignSelf: 'MIN'
    })

    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, id)).toMatchObject({
      width: 500,
      height: 100,
      layoutAlignSelf: 'AUTO'
    })

    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, id)).toMatchObject({
      width: 200,
      height: 300,
      layoutAlignSelf: 'MIN'
    })
  })

  test('repositions constrained descendants after an in-flow child grows', () => {
    const editor = createEditor()
    const id = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      width: 100,
      height: 100,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    }).id
    const childId = editor.graph.createNode('FRAME', id, {
      width: 100,
      height: 100,
      layoutGrow: 1
    }).id
    const nestedId = editor.graph.createNode('RECTANGLE', childId, {
      x: 80,
      y: 0,
      width: 10,
      height: 10,
      horizontalConstraint: 'MAX'
    }).id

    editor.resizeFrameToPreset(id, { name: 'Wide', width: 200, height: 100 })
    expect(getNodeOrThrow(editor.graph, childId).width).toBe(200)
    expect(getNodeOrThrow(editor.graph, nestedId).x).toBe(180)

    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, childId).width).toBe(100)
    expect(getNodeOrThrow(editor.graph, nestedId).x).toBe(80)

    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, childId).width).toBe(200)
    expect(getNodeOrThrow(editor.graph, nestedId).x).toBe(180)
  })
})
