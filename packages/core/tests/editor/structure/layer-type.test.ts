import { describe, expect, test } from 'bun:test'

import { createEditor, layerTypeOptions } from '@open-pencil/core'
import { getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'

// Each case repeats the layer type menu in Figma desktop 126's properties panel.

function setup() {
  const editor = createEditor()
  const page = editor.state.currentPageId
  const frame = editor.graph.createNode('FRAME', page, {
    x: 9000,
    y: 100,
    width: 200,
    height: 150,
    fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 1, a: 1 }, opacity: 1, visible: true }],
    strokes: [
      {
        type: 'SOLID',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        weight: 1,
        align: 'INSIDE'
      }
    ],
    cornerRadius: 8,
    clipsContent: true,
    opacity: 0.8,
    effects: [
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.25 },
        offset: { x: 0, y: 4 },
        radius: 4,
        spread: 0,
        visible: true
      }
    ]
  })
  const box = editor.graph.createNode('RECTANGLE', frame.id, {
    x: 20,
    y: 30,
    width: 50,
    height: 40
  })
  // Sticks out past the frame's right and bottom edges.
  const dot = editor.graph.createNode('ELLIPSE', frame.id, {
    x: 180,
    y: 120,
    width: 60,
    height: 60
  })
  return { editor, frame, box, dot }
}

const canvasBox = (editor: ReturnType<typeof createEditor>, id: string) => {
  const node = editor.graph.getNode(id)
  if (!node) throw new Error(`Missing ${id}`)
  const { x, y, width, height } = getAxisAlignedWorldBounds(node, editor.graph)
  return [x, y, width, height]
}

describe('layer type menu', () => {
  test('a frame becomes a group in place, fitting its layers and keeping its effects', () => {
    const { editor, frame, box, dot } = setup()
    const boxBefore = canvasBox(editor, box.id)
    const dotBefore = canvasBox(editor, dot.id)
    editor.convertLayerType(frame.id, 'GROUP')
    const group = editor.graph.getNode(frame.id)
    expect(group).toMatchObject({
      type: 'GROUP',
      fills: [],
      strokes: [],
      cornerRadius: 0,
      opacity: 0.8
    })
    expect(group?.effects).toHaveLength(1)
    expect(canvasBox(editor, frame.id)).toEqual([9020, 130, 220, 150])
    expect(canvasBox(editor, box.id)).toEqual(boxBefore)
    expect(canvasBox(editor, dot.id)).toEqual(dotBefore)

    editor.undo.undo()
    expect(editor.graph.getNode(frame.id)).toMatchObject({
      type: 'FRAME',
      x: 9000,
      y: 100,
      width: 200,
      height: 150,
      cornerRadius: 8,
      clipsContent: true
    })
    expect(editor.graph.getNode(frame.id)?.fills).toHaveLength(1)
    expect(canvasBox(editor, dot.id)).toEqual(dotBefore)
    editor.undo.redo()
    expect(editor.graph.getNode(frame.id)?.type).toBe('GROUP')
    expect(canvasBox(editor, frame.id)).toEqual([9020, 130, 220, 150])
  })

  test('a group becomes a frame of its bounds that clips, with no fill', () => {
    const { editor, frame } = setup()
    editor.convertLayerType(frame.id, 'GROUP')
    editor.convertLayerType(frame.id, 'FRAME')
    expect(editor.graph.getNode(frame.id)).toMatchObject({
      type: 'FRAME',
      fills: [],
      clipsContent: true,
      opacity: 0.8
    })
    expect(canvasBox(editor, frame.id)).toEqual([9020, 130, 220, 150])
  })

  test('undo brings back a frame’s linked fill, stroke, and guide styles', () => {
    const { editor, frame } = setup()
    const styles = { fillStyleId: '1:10', strokeStyleId: '1:11', gridStyleId: '1:12' }
    editor.graph.updateNode(frame.id, styles)
    editor.convertLayerType(frame.id, 'GROUP')
    expect(editor.graph.getNode(frame.id)).toMatchObject({
      fillStyleId: null,
      strokeStyleId: null,
      gridStyleId: null
    })
    editor.undo.undo()
    expect(editor.graph.getNode(frame.id)).toMatchObject(styles)
  })

  test('an empty frame has nothing to group', () => {
    const editor = createEditor()
    const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      width: 100,
      height: 100
    })
    editor.convertLayerType(frame.id, 'GROUP')
    expect(editor.graph.getNode(frame.id)?.type).toBe('FRAME')
  })

  test('a frame on the page becomes a section that keeps its look but what a section lacks', () => {
    const { editor, frame, dot } = setup()
    editor.graph.updateNode(frame.id, {
      strokes: [{ ...frame.strokes[0], weight: 2 }],
      strokeWeight: 2
    })
    const dotBefore = canvasBox(editor, dot.id)
    editor.convertLayerType(frame.id, 'SECTION')
    expect(editor.graph.getNode(frame.id)).toMatchObject({
      type: 'SECTION',
      cornerRadius: 8,
      opacity: 1,
      effects: [],
      clipsContent: false,
      strokeWeight: 1
    })
    expect(editor.graph.getNode(frame.id)?.fills).toHaveLength(1)
    expect(editor.graph.getNode(frame.id)?.strokes.map((stroke) => stroke.weight)).toEqual([1])
    expect(canvasBox(editor, frame.id)).toEqual([9000, 100, 200, 150])
    expect(canvasBox(editor, dot.id)).toEqual(dotBefore)

    editor.undo.undo()
    expect(editor.graph.getNode(frame.id)).toMatchObject({
      type: 'FRAME',
      opacity: 0.8,
      clipsContent: true,
      strokeWeight: 2
    })
    expect(editor.graph.getNode(frame.id)?.effects).toHaveLength(1)

    editor.undo.redo()
    editor.convertLayerType(frame.id, 'FRAME')
    expect(editor.graph.getNode(frame.id)).toMatchObject({
      type: 'FRAME',
      clipsContent: true,
      cornerRadius: 8,
      opacity: 1
    })
    expect(editor.graph.getNode(frame.id)?.fills).toHaveLength(1)
  })

  test('an auto layout frame becomes a section with its layers where layout put them', () => {
    const editor = createEditor()
    const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      width: 200,
      height: 100,
      layoutMode: 'VERTICAL',
      paddingLeft: 8
    })
    const child = editor.graph.createNode('RECTANGLE', frame.id, { width: 100, height: 40 })
    editor.runLayoutForNode(frame.id)
    const placed = canvasBox(editor, child.id)
    editor.convertLayerType(frame.id, 'SECTION')
    expect(editor.graph.getNode(frame.id)?.layoutMode).toBe('NONE')
    expect(canvasBox(editor, child.id)).toEqual(placed)
  })

  test('a group becomes a section of its bounds, with no fill', () => {
    const { editor, frame, box } = setup()
    editor.convertLayerType(frame.id, 'GROUP')
    const boxBefore = canvasBox(editor, box.id)
    editor.convertLayerType(frame.id, 'SECTION')
    expect(editor.graph.getNode(frame.id)).toMatchObject({ type: 'SECTION', fills: [], opacity: 1 })
    expect(canvasBox(editor, frame.id)).toEqual([9020, 130, 220, 150])
    expect(canvasBox(editor, box.id)).toEqual(boxBefore)
  })

  test('offers a section on the page or in a section, a group of layers, and no group of a section', () => {
    const editor = createEditor()
    const page = editor.state.currentPageId
    const section = editor.graph.createNode('SECTION', page, { width: 400, height: 300 })
    const inSection = editor.graph.createNode('FRAME', section.id, { width: 100, height: 80 })
    const outer = editor.graph.createNode('FRAME', page, { width: 300, height: 250 })
    const nested = editor.graph.createNode('FRAME', outer.id, { width: 100, height: 80 })
    editor.graph.createNode('RECTANGLE', section.id, { width: 10, height: 10 })
    const options = (id: string) => {
      const node = editor.graph.getNode(id)
      if (!node) throw new Error(`Missing ${id}`)
      return layerTypeOptions(editor.graph, node)
    }
    expect(options(inSection.id)).toEqual({ FRAME: true, GROUP: false, SECTION: true })
    expect(options(nested.id)).toEqual({ FRAME: true, GROUP: false, SECTION: false })
    expect(options(section.id)).toEqual({ FRAME: true, GROUP: false, SECTION: true })
    editor.convertLayerType(nested.id, 'SECTION')
    expect(editor.graph.getNode(nested.id)?.type).toBe('FRAME')
  })

  test('a section holding a section stays one, as a frame cannot hold it', () => {
    const editor = createEditor()
    const outer = editor.graph.createNode('SECTION', editor.state.currentPageId, {
      width: 600,
      height: 400
    })
    editor.graph.createNode('SECTION', outer.id, { width: 200, height: 150 })
    const node = editor.graph.getNode(outer.id)
    if (!node) throw new Error('Missing section')
    expect(layerTypeOptions(editor.graph, node).FRAME).toBe(false)
    editor.convertLayerType(outer.id, 'FRAME')
    expect(editor.graph.getNode(outer.id)?.type).toBe('SECTION')
  })
})
