import { afterEach, describe, expect, test } from 'bun:test'

import {
  createEditorWithRenderer,
  disposeFlattenEditors,
  loadInterBold,
  loadInterRegular,
  loadNotoSansSC
} from '#core-tests/helpers/flatten'

import { createEditor } from '@open-pencil/core'

import { textNodeToOutlineLayout } from '#core/text/outlines'

afterEach(disposeFlattenEditors)

describe('flattenSelected on text', () => {
  test('flattens text glyph by glyph in its characters’ fills, with its underline', async () => {
    // Recorded in Figma desktop 126 (scratch/pr-oracle/grouping): "Hey" in two colours with an
    // underline flattens to one vector named after the text, one region per glyph in its
    // character's fill and one for the underline, keeping the text's opacity and effects.
    await loadInterRegular()
    const { editor, renderer } = await createEditorWithRenderer()
    await renderer.loadFonts()
    const pageId = editor.state.currentPageId
    const red = {
      type: 'SOLID' as const,
      color: { r: 1, g: 0, b: 0, a: 1 },
      opacity: 1,
      visible: true
    }
    const blue = { ...red, color: { r: 0, g: 0, b: 1, a: 1 } }
    const shadow = {
      type: 'DROP_SHADOW' as const,
      color: { r: 0, g: 0, b: 0, a: 0.5 },
      offset: { x: 2, y: 2 },
      radius: 4,
      spread: 0,
      visible: true,
      blendMode: 'NORMAL' as const
    }
    const text = editor.graph.createNode('TEXT', pageId, {
      name: 'Title',
      text: 'Hey',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 40,
      width: 120,
      height: 50,
      textDecoration: 'UNDERLINE',
      opacity: 0.5,
      effects: [shadow],
      styleRuns: [
        { start: 0, length: 1, style: { fills: [red] } },
        { start: 1, length: 2, style: { fills: [blue] } }
      ]
    })

    editor.select([text.id])
    editor.flattenSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.name).toBe('Title')
    expect(vector?.opacity).toBe(0.5)
    expect(vector?.effects.map((effect) => effect.type)).toEqual(['DROP_SHADOW'])
    const regionColors = new Set(
      vector?.vectorNetwork?.regions.map((region) => JSON.stringify(region.fills?.[0]?.color))
    )
    expect(regionColors).toEqual(new Set([JSON.stringify(red.color), JSON.stringify(blue.color)]))
    // Three glyphs and the underline.
    expect(vector?.vectorNetwork?.regions.length).toBeGreaterThanOrEqual(4)
  })

  test('flattens text without a layer fill, which the canvas does not draw, unpainted', async () => {
    await loadInterRegular()
    const { editor, renderer } = await createEditorWithRenderer()
    await renderer.loadFonts()
    const red = {
      type: 'SOLID' as const,
      color: { r: 1, g: 0, b: 0, a: 1 },
      opacity: 1,
      visible: true
    }
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'Hey',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 40,
      width: 120,
      height: 50,
      fills: [],
      textDecoration: 'UNDERLINE',
      styleRuns: [{ start: 0, length: 3, style: { fills: [red] } }]
    })

    editor.select([text.id])
    editor.flattenSelected()

    const vector = editor.graph.getNode([...editor.state.selectedIds][0] ?? '')
    const painted = (vector?.vectorNetwork?.regions ?? []).filter((region) =>
      (region.fills ?? vector?.fills ?? []).some((fill) => fill.visible)
    )
    expect(painted).toEqual([])
  })

  test('flattens loaded text as outlines', async () => {
    await loadInterRegular()
    const { editor } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'Hi',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 32,
      width: 80,
      height: 40
    })

    editor.select([text.id])
    editor.flattenSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.type).toBe('VECTOR')
    expect(vector?.vectorNetwork?.vertices.length).toBeGreaterThan(0)
    expect(editor.graph.getNode(text.id)).toBeUndefined()
  })

  // An underline starts at the items' text, so the bullets stay the leftmost ink either way.
  test.each(['NONE', 'UNDERLINE'] as const)(
    'flattens a list with its bullets, as the canvas draws it (%s)',
    async (textDecoration) => {
      await loadInterRegular()
      const { editor, renderer } = await createEditorWithRenderer()
      await renderer.loadFonts()
      const pageId = editor.state.currentPageId
      const text = editor.graph.createNode('TEXT', pageId, {
        x: 100,
        text: 'One\nTwo',
        fontFamily: 'Inter',
        fontWeight: 400,
        fontSize: 16,
        width: 120,
        height: 40,
        textDecoration,
        textParagraphs: [
          { listType: 'UNORDERED', indentation: 1 },
          { listType: 'UNORDERED', indentation: 1 }
        ]
      })

      editor.select([text.id])
      editor.flattenSelected()

      const [vectorId] = [...editor.state.selectedIds]
      const vector = editor.graph.getNode(vectorId)
      // The bullets sit in the first 24px of indent, left of the items' text.
      expect(vector?.x).toBeGreaterThan(106)
      expect(vector?.x).toBeLessThan(112)
    }
  )

  test('wraps loaded text style runs as outlines', async () => {
    await loadInterRegular()
    await loadInterBold()
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'Hello world',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 32,
      width: 100,
      height: 100,
      styleRuns: [{ start: 6, length: 5, style: { fontWeight: 700 } }]
    })

    const layout = textNodeToOutlineLayout(text)

    expect(layout).not.toBeNull()
    expect(layout?.height).toBeGreaterThan(40)
  })

  test('flattens loaded text style runs as outlines', async () => {
    await loadInterRegular()
    await loadInterBold()
    const { editor } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'Hi',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 32,
      width: 80,
      height: 40,
      styleRuns: [{ start: 1, length: 1, style: { fontWeight: 700, fontSize: 40 } }]
    })

    editor.select([text.id])
    editor.flattenSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.type).toBe('VECTOR')
    expect(vector?.vectorNetwork?.vertices.length).toBeGreaterThan(0)
  })

  test('flattens mixed Latin and CJK text with loaded fallback outlines', async () => {
    await loadInterRegular()
    const hasCJKFallback = await loadNotoSansSC()
    if (!hasCJKFallback) return
    const { editor } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'Hi你',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 32,
      width: 120,
      height: 40
    })

    editor.select([text.id])
    editor.flattenSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.type).toBe('VECTOR')
    expect(vector?.vectorNetwork?.vertices.length).toBeGreaterThan(0)
  })

  test('does not flatten complex script text without shaping support', async () => {
    await loadInterRegular()
    const { editor } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'مرحبا',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 32,
      width: 120,
      height: 40
    })

    editor.select([text.id])
    const result = editor.flattenSelected()

    expect(result).toBeNull()
    expect(editor.graph.getNode(text.id)?.type).toBe('TEXT')
  })

  test('does not flatten unsupported text nodes', async () => {
    const { editor } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'Nope',
      fontFamily: 'Definitely Missing Font'
    })
    const rect = editor.graph.createNode('RECTANGLE', pageId)

    editor.select([text.id, rect.id])
    const result = editor.flattenSelected()

    expect(result).toBeNull()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([text.id, rect.id])
    expect(editor.state.selectedIds).toEqual(new Set([text.id, rect.id]))
  })
})
