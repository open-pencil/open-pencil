import { describe, expect, test } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import type { StyleRun, TextParagraphStyle } from '@open-pencil/scene-graph'

import { createEditor, findInDocument, replaceHits, replaceRanges } from '#core/editor'

const INSENSITIVE = { matchCase: false, wholeWord: false }

function replaced(
  text: string,
  ranges: { start: number; end: number }[],
  replacement: string,
  styleRuns: StyleRun[] = [],
  textParagraphs: TextParagraphStyle[] = []
) {
  return replaceRanges({ text, styleRuns, textParagraphs }, ranges, replacement)
}

describe('replaceRanges', () => {
  test('replaces several ranges, from the end so earlier ones stay valid', () => {
    const result = replaced(
      'one two one',
      [
        { start: 0, end: 3 },
        { start: 8, end: 11 }
      ],
      'seven'
    )
    expect(result?.text).toBe('seven two seven')
  })

  test('returns null when nothing changes', () => {
    expect(replaced('one', [], 'two')).toBeNull()
    expect(replaced('one', [{ start: 0, end: 3 }], 'one')).toBeNull()
  })

  test('the replacement takes the style of the first replaced character', () => {
    const bold: StyleRun = { start: 4, length: 3, style: { fontWeight: 700 } }
    const result = replaced('say foo now', [{ start: 4, end: 7 }], 'quux', [bold])
    expect(result?.text).toBe('say quux now')
    expect(result?.styleRuns).toEqual([{ start: 4, length: 4, style: { fontWeight: 700 } }])
  })

  test('styles after the replacement move with their characters', () => {
    const link: StyleRun = {
      start: 8,
      length: 3,
      style: { hyperlink: { type: 'URL', value: 'https://example.com' } }
    }
    const result = replaced('foo and bar', [{ start: 0, end: 3 }], 'quux', [link])
    expect(result?.styleRuns).toEqual([{ ...link, start: 9 }])
  })

  test('deleting a match leaves the surrounding styles in place', () => {
    const bold: StyleRun = { start: 4, length: 3, style: { fontWeight: 700 } }
    const result = replaced('say foo now', [{ start: 4, end: 7 }], '', [bold])
    expect(result?.text).toBe('say  now')
    expect(result?.styleRuns).toEqual([])
  })

  test('a replacement with a line break starts a paragraph in the list style', () => {
    const bullet: TextParagraphStyle = { listType: 'UNORDERED', indentation: 1 }
    const result = replaced('item foo', [{ start: 5, end: 8 }], 'a\nb', [], [bullet])
    expect(result?.text).toBe('item a\nb')
    expect(result?.textParagraphs).toEqual([bullet, bullet])
  })
})

describe('replaceHits', () => {
  function setup() {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const a = editor.graph.createNode('TEXT', pageId, { name: 'A', text: 'Pencil and pencil' })
    const b = editor.graph.createNode('TEXT', pageId, { name: 'B', text: 'Pencil' })
    const locked = editor.graph.createNode('TEXT', pageId, {
      name: 'Locked',
      text: 'Pencil',
      locked: true
    })
    const hits = findInDocument(editor.graph, 'pencil', INSENSITIVE, { scope: 'page', pageId })
    return { editor, a, b, locked, hits }
  }

  test('replaces every match except in locked layers, in one undo step', () => {
    const { editor, a, b, locked, hits } = setup()
    expect(replaceHits(editor, hits, 'Pen')).toBe(3)
    expect(getNodeOrThrow(editor.graph, a.id).text).toBe('Pen and Pen')
    expect(getNodeOrThrow(editor.graph, b.id).text).toBe('Pen')
    expect(getNodeOrThrow(editor.graph, locked.id).text).toBe('Pencil')

    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, a.id).text).toBe('Pencil and pencil')
    expect(getNodeOrThrow(editor.graph, b.id).text).toBe('Pencil')
    expect(editor.undo.canUndo).toBe(false)

    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, a.id).text).toBe('Pen and Pen')
  })

  test('replaces one match and leaves its neighbours', () => {
    const { editor, a, hits } = setup()
    const [first] = hits
    expect(replaceHits(editor, [{ ...first, ranges: [first.ranges[1]] }], 'Pen')).toBe(1)
    expect(getNodeOrThrow(editor.graph, a.id).text).toBe('Pencil and Pen')
  })

  test('a layer deleted since the search is skipped', () => {
    const { editor, a, b, hits } = setup()
    editor.graph.deleteNode(a.id)
    expect(replaceHits(editor, hits, 'Pen')).toBe(1)
    expect(getNodeOrThrow(editor.graph, b.id).text).toBe('Pen')
  })
})
