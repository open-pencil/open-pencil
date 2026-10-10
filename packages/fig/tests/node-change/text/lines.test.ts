import { describe, expect, test } from 'bun:test'

import { exportTextData } from '#fig/node-change/text/data-export'
import { exportTextLines, importParagraphStyles } from '#fig/node-change/text/lines'

import { SceneGraph, type TextParagraphStyle } from '@open-pencil/scene-graph'

describe('importParagraphStyles', () => {
  test('nests a list line with no stored level at the first level', () => {
    expect(
      importParagraphStyles([
        { lineType: 'UNORDERED_LIST' },
        { lineType: 'ORDERED_LIST', indentationLevel: 9 },
        { lineType: 'PLAIN', indentationLevel: 2 }
      ])
    ).toEqual([
      { listType: 'UNORDERED', indentation: 1 },
      { listType: 'ORDERED', indentation: 5 },
      { listType: 'NONE', indentation: 2 }
    ])
  })
})

// Lines and overrides as live Figma (2026-10-10) writes a text with spacing of its own on some
// paragraphs and a bold run: paragraphs and characters share the table with distinct ids.
const FIGMA_LINES = [
  { lineType: 'PLAIN', styleId: 0 },
  { lineType: 'PLAIN', styleId: 1 },
  { lineType: 'ORDERED_LIST', styleId: 0, indentationLevel: 1 },
  { lineType: 'ORDERED_LIST', styleId: 4, indentationLevel: 1 },
  { lineType: 'PLAIN', styleId: 5 },
  { lineType: 'PLAIN', styleId: 0 }
] as const
const FIGMA_OVERRIDES = [
  { styleID: 1, paragraphSpacing: 25 },
  { styleID: 3, fontName: { family: 'Inter', style: 'Bold', postscript: '' } },
  { styleID: 4, paragraphSpacing: 40 },
  { styleID: 5, listSpacing: 33 }
]
const plain: TextParagraphStyle = { listType: 'NONE', indentation: 0 }
const item: TextParagraphStyle = { listType: 'ORDERED', indentation: 1 }

describe('paragraph spacing in lines', () => {
  test("reads each paragraph's own spacing from the override its line names", () => {
    expect(importParagraphStyles([...FIGMA_LINES], FIGMA_OVERRIDES)).toEqual([
      plain,
      { ...plain, paragraphSpacing: 25 },
      item,
      { ...item, paragraphSpacing: 40 },
      { ...plain, listSpacing: 33 }
    ])
  })

  test('writes overrides after the character styles, one per distinct spacing', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'P1\nP2\nI1',
      styleRuns: [{ start: 3, length: 2, style: { fontWeight: 700 } }],
      textParagraphs: [
        { ...plain, paragraphSpacing: 25 },
        { ...plain, paragraphSpacing: 25 },
        { ...item, listSpacing: 4 }
      ]
    })
    const data = exportTextData(node, () => ({ type: 'SOLID' }))
    expect(data?.lines?.map((line) => line.styleId)).toEqual([2, 2, 3])
    expect(
      data?.styleOverrideTable?.map(({ styleID, paragraphSpacing, listSpacing }) => ({
        styleID,
        paragraphSpacing,
        listSpacing
      }))
    ).toEqual([
      { styleID: 1, paragraphSpacing: undefined, listSpacing: undefined },
      { styleID: 2, paragraphSpacing: 25, listSpacing: undefined },
      { styleID: 3, paragraphSpacing: undefined, listSpacing: 4 }
    ])
    expect(importParagraphStyles(data?.lines, data?.styleOverrideTable)).toEqual(
      node.textParagraphs
    )
  })

  test('writes no override table for text without spacing of its own', () => {
    const { lines, overrides } = exportTextLines({ text: 'A\nB', textParagraphs: [item] })
    expect(lines.map((line) => line.styleId)).toEqual([0, 0])
    expect(overrides).toEqual([])
  })
})
