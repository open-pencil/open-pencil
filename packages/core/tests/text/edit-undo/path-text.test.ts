import { describe, test, expect } from 'bun:test'

import { setupTextEdit } from '#core-tests/helpers/text/edit'

import type { DerivedTextGlyph } from '@open-pencil/scene-graph'
import { expectDefined, getNodeOrThrow } from '@open-pencil/test-support/assert'

import { fontManager } from '#core/text/font/manager'

function straightTextPathNetwork() {
  return {
    vertices: [
      { x: 0, y: 20 },
      { x: 200, y: 20 }
    ],
    segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
    regions: []
  }
}

async function setupPathText() {
  const font = await fontManager.fetchBundledFont('/InterVariable.ttf')
  expect(font).toBeTruthy()
  if (!font) return null
  await fontManager.markLoaded('Inter', 'Regular', font)

  const setupResult = setupTextEdit()
  const glyphs: DerivedTextGlyph[] = [
    { commandsBlob: new Uint8Array([0]), x: 20, y: 20, fontSize: 20, rotation: 0 },
    { commandsBlob: new Uint8Array([0]), x: 40, y: 20, fontSize: 20, rotation: 0 }
  ]
  setupResult.graph.updateNode(setupResult.textNode.id, {
    text: 'AB',
    fontFamily: 'Inter',
    fontSize: 20,
    width: 200,
    height: 40,
    textPathData: {
      network: straightTextPathNetwork(),
      normalizedSize: { x: 200, y: 40 },
      tValue: 0,
      forward: true
    },
    textPathBox: { x: 0, y: 0, width: 200, height: 40 },
    derivedTextGlyphs: glyphs
  })
  return setupResult
}

describe('text edit undo on a path', () => {
  test('reflows live path-text edits and restores glyphs through undo and redo', async () => {
    const setupResult = await setupPathText()
    if (!setupResult) return
    const { graph, undo, textEditor, textNode, actions } = setupResult
    const originalGlyphs = structuredClone(
      expectDefined(getNodeOrThrow(graph, textNode.id).derivedTextGlyphs)
    )

    actions.startTextEditing(textNode.id)
    textEditor.insert('C', getNodeOrThrow(graph, textNode.id))
    actions.updateTextEditNode(textNode.id, {
      text: expectDefined(textEditor.state, 'text editor state').text
    })

    const liveGlyphs = expectDefined(getNodeOrThrow(graph, textNode.id).derivedTextGlyphs)
    expect(liveGlyphs).toHaveLength(3)
    expect(liveGlyphs).not.toEqual(originalGlyphs)

    actions.commitTextEdit()
    const committedGlyphs = structuredClone(
      expectDefined(getNodeOrThrow(graph, textNode.id).derivedTextGlyphs)
    )
    undo.undo()
    expect(getNodeOrThrow(graph, textNode.id).text).toBe('AB')
    expect(getNodeOrThrow(graph, textNode.id).derivedTextGlyphs).toEqual(originalGlyphs)

    undo.redo()
    expect(getNodeOrThrow(graph, textNode.id).text).toBe('ABC')
    expect(getNodeOrThrow(graph, textNode.id).derivedTextGlyphs).toEqual(committedGlyphs)
  })

  test('restores path identity when undoing an edit to empty text', async () => {
    const setupResult = await setupPathText()
    if (!setupResult) return
    const { graph, undo, textEditor, textNode, actions } = setupResult
    const originalPathData = structuredClone(
      expectDefined(getNodeOrThrow(graph, textNode.id).textPathData)
    )

    actions.startTextEditing(textNode.id)
    textEditor.selectAll()
    textEditor.backspace(getNodeOrThrow(graph, textNode.id))
    actions.updateTextEditNode(textNode.id, { text: '' })
    actions.commitTextEdit()

    expect(getNodeOrThrow(graph, textNode.id).textPathData).toBeNull()
    undo.undo()
    expect(getNodeOrThrow(graph, textNode.id).text).toBe('AB')
    expect(getNodeOrThrow(graph, textNode.id).textPathData).toEqual(originalPathData)
    undo.redo()
    expect(getNodeOrThrow(graph, textNode.id).text).toBe('')
    expect(getNodeOrThrow(graph, textNode.id).textPathData).toBeNull()
  })
})
