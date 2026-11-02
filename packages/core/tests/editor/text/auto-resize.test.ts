import { afterEach, describe, expect, test } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import { createEditor } from '@open-pencil/core'
import { setTextMeasurer } from '@open-pencil/core/layout'
import { lineHeightPixels, pixelLength } from '@open-pencil/scene-graph/text'

afterEach(() => {
  setTextMeasurer(null)
})

describe('editor text auto-resize updates', () => {
  test('lineHeight changes resize auto-height text', () => {
    setTextMeasurer((node) => ({
      width: node.width,
      height: lineHeightPixels(node.lineHeight, node.fontSize) ?? 20
    }))

    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'Hello',
      textAutoResize: 'HEIGHT',
      width: 120,
      height: 20,
      lineHeight: pixelLength(20)
    })

    editor.updateNode(text.id, { lineHeight: pixelLength(48) })

    expect(getNodeOrThrow(editor.graph, text.id).lineHeight).toEqual(pixelLength(48))
    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(48)
  })

  test('lineHeight changes on auto-height text are undoable with height', () => {
    setTextMeasurer((node) => ({
      width: node.width,
      height: lineHeightPixels(node.lineHeight, node.fontSize) ?? 20
    }))

    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'Hello',
      textAutoResize: 'HEIGHT',
      width: 120,
      height: 20,
      lineHeight: pixelLength(20)
    })

    editor.updateNodeWithUndo(text.id, { lineHeight: pixelLength(48) }, 'Change lineHeight')

    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(48)
    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, text.id).lineHeight).toEqual(pixelLength(20))
    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(20)
    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, text.id).lineHeight).toEqual(pixelLength(48))
    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(48)
  })

  test('direct edits drop stale path glyphs without paragraph auto-resize', () => {
    // A mutation outside the font-gated canvas edit session cannot reflow the
    // glyphs. It must clear stale outlines/path identity without applying
    // paragraph auto-resize to the imported path-text box.
    setTextMeasurer((node) => ({
      width: node.width,
      height: lineHeightPixels(node.lineHeight, node.fontSize) ?? 20
    }))

    const editor = createEditor()
    const glyphs = [
      { commandsBlob: new Uint8Array([1, 0, 0, 0, 0]), x: 0, y: 0, fontSize: 80 },
      { commandsBlob: new Uint8Array([1, 0, 0, 0, 0]), x: 40, y: 5, fontSize: 80 }
    ]
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'ab',
      textAutoResize: 'HEIGHT',
      width: 200,
      height: 200,
      fontFamily: 'NoSuchFont',
      fontSize: 80,
      textPathData: {
        network: {
          vertices: [
            { x: 0, y: 100 },
            { x: 200, y: 100 }
          ],
          segments: [
            { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
          ],
          regions: []
        },
        normalizedSize: { x: 200, y: 200 },
        tValue: 0,
        forward: true
      },
      textPathBox: { x: 0, y: 0, width: 200, height: 200 },
      derivedTextGlyphs: glyphs
    })

    editor.updateNode(text.id, { text: 'abc' })

    const updated = getNodeOrThrow(editor.graph, text.id)
    expect(updated.derivedTextGlyphs).toBeNull()
    expect(updated.textPathData).toBeNull()
    expect(updated.height).toBe(200)
  })

  test('font size changes resize width-and-height text', () => {
    setTextMeasurer((node) => ({ width: node.fontSize * 4, height: node.fontSize * 2 }))

    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'Text',
      textAutoResize: 'WIDTH_AND_HEIGHT',
      width: 40,
      height: 20,
      fontSize: 10
    })

    editor.updateNode(text.id, { fontSize: 16 })

    expect(getNodeOrThrow(editor.graph, text.id).width).toBe(64)
    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(32)
  })

  test('auto-width text takes the width its case gives it', () => {
    setTextMeasurer((node) => ({
      width: (node.text?.length ?? 0) * (node.textCase === 'UPPER' ? 20 : 10),
      height: 20
    }))
    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'ten chars!',
      textAutoResize: 'WIDTH_AND_HEIGHT',
      width: 100,
      height: 20
    })

    editor.updateNode(text.id, { textCase: 'UPPER' })

    expect(getNodeOrThrow(editor.graph, text.id).width).toBe(200)
  })

  test('auto-width text takes the width its direction gives it', () => {
    setTextMeasurer((node) => ({
      width: (node.text?.length ?? 0) * (node.textDirection === 'RTL' ? 20 : 10),
      height: 20
    }))
    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'ten chars!',
      textAutoResize: 'WIDTH_AND_HEIGHT',
      width: 100,
      height: 20
    })

    editor.updateNode(text.id, { textDirection: 'RTL' })

    expect(getNodeOrThrow(editor.graph, text.id).width).toBe(200)
  })
})

// Figma 126 draws a fixed-size text's lines past its box, so they are measured even though the
// box keeps its size.
describe('fixed-size text', () => {
  test('keeps its box and measures how far its lines reach', () => {
    setTextMeasurer((node, maxWidth) => {
      const width = (node.text?.length ?? 0) * node.fontSize * 0.5
      const lines = maxWidth ? Math.ceil(width / maxWidth) : 1
      return { width: Math.min(width, maxWidth ?? width), height: lines * node.fontSize * 1.2 }
    })
    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'dssdds',
      textAutoResize: 'NONE',
      width: 110,
      height: 40,
      fontSize: 14
    })

    editor.updateNode(text.id, { fontSize: 64 })

    const node = getNodeOrThrow(editor.graph, text.id)
    expect([node.width, node.height]).toEqual([110, 40])
    expect(node.derivedTextHeight).toBeCloseTo(2 * 64 * 1.2)
  })

  test('auto-sized text has no lines past its box', () => {
    setTextMeasurer((node) => ({ width: 100, height: node.fontSize * 1.2 }))
    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'Hello',
      textAutoResize: 'NONE',
      width: 50,
      height: 10,
      derivedTextHeight: 80
    })

    editor.updateNode(text.id, { textAutoResize: 'WIDTH_AND_HEIGHT' })

    expect(getNodeOrThrow(editor.graph, text.id).derivedTextHeight).toBeNull()
  })

  test('measures its lines again when their case changes', () => {
    // Upper case takes more room here, so the same text wraps onto more lines.
    setTextMeasurer((node, maxWidth) => {
      const width = (node.text?.length ?? 0) * (node.textCase === 'UPPER' ? 20 : 10)
      const lines = maxWidth ? Math.ceil(width / maxWidth) : 1
      return { width: Math.min(width, maxWidth ?? width), height: lines * 20 }
    })
    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'ten chars!',
      textAutoResize: 'NONE',
      width: 100,
      height: 20
    })

    editor.updateNode(text.id, { textCase: 'UPPER' })

    expect(getNodeOrThrow(editor.graph, text.id).derivedTextHeight).toBe(40)
  })
})
