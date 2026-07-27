import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { svgToVectorPaths } from '@open-pencil/core/vector'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'

function vectorizedInset() {
  return expectDefined(
    svgToVectorPaths(
      `<svg viewBox="0 0 100 100"><path d="M25 10 H75 V90 H25 Z" fill="#336699"/></svg>`,
      { width: 200, height: 100 }
    ),
    'vectorized SVG'
  )
}

describe('replaceNodeWithVectorFrame', () => {
  test('replaces an image node in place and restores it with undo', () => {
    const editor = createEditor()
    const page = expectDefined(editor.graph.getPages()[0], 'page')
    const source = editor.graph.createNode('RECTANGLE', page.id, {
      name: 'Photo',
      x: 40,
      y: 60,
      width: 200,
      height: 100,
      opacity: 0.75,
      cornerRadius: 12,
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.3 },
          offset: { x: 0, y: 4 },
          radius: 8,
          spread: 0,
          visible: true,
          blendMode: 'NORMAL'
        }
      ]
    })
    editor.select([source.id])

    const frameId = expectDefined(
      editor.replaceNodeWithVectorFrame(source.id, vectorizedInset()),
      'replacement frame'
    )
    const frame = getNodeOrThrow(editor.graph, frameId)
    expect(frame.type).toBe('FRAME')
    expect(frame).toMatchObject({
      x: 90,
      y: 70,
      width: 100,
      height: 80,
      opacity: 0.75,
      cornerRadius: 12,
      clipsContent: true
    })
    expect(frame.effects).toHaveLength(1)
    expect(frame.childIds).toHaveLength(1)
    expect(editor.graph.getNode(source.id)).toBeUndefined()

    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, source.id).type).toBe('RECTANGLE')
    expect(editor.graph.getNode(frameId)).toBeUndefined()
    expect([...editor.state.selectedIds]).toEqual([source.id])

    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, frameId).type).toBe('FRAME')
    expect(editor.graph.getNode(source.id)).toBeUndefined()
  })

  test('preserves the coordinate box and rotation of rotated images', () => {
    const editor = createEditor()
    const page = expectDefined(editor.graph.getPages()[0], 'page')
    const source = editor.graph.createNode('RECTANGLE', page.id, {
      x: 40,
      y: 60,
      width: 200,
      height: 100,
      rotation: 30
    })

    const frameId = expectDefined(
      editor.replaceNodeWithVectorFrame(source.id, vectorizedInset()),
      'replacement frame'
    )
    expect(getNodeOrThrow(editor.graph, frameId)).toMatchObject({
      x: 40,
      y: 60,
      width: 200,
      height: 100,
      rotation: 30
    })
  })
})
