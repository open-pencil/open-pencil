import { expect, test } from 'bun:test'

import {
  EMPTY_EXPORT_RUNTIME,
  nodeChangeToProps,
  sceneNodeToKiwi
} from '@open-pencil/fig/node-change'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

function write(fields: Partial<SceneNode>, runtime = EMPTY_EXPORT_RUNTIME): NodeChange {
  const graph = new SceneGraph()
  const node = graph.createNode('TEXT', graph.getPages()[0].id, { text: 'Faces', ...fields })
  return sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [], {
    runtime,
    fontDigestMap: new Map()
  })[0]
}

test('keeps the name a file gives a face, which its weight and slant cannot always name', () => {
  // Measured in Figma desktop: a face is found by its exact name, as its font gives it.
  for (const [family, style] of [
    ['Roboto', 'SemiBold'],
    ['Avenir', 'Book'],
    ['Roboto', 'Condensed Bold'],
    ['SF Pro', 'Regular Italic']
  ] as const) {
    const props = nodeChangeToProps(
      { type: 'TEXT', fontName: { family, style, postscript: '' } } as NodeChange,
      []
    )
    expect(props.fontStyle).toBe(style)
    expect(write(props).fontName?.style).toBe(style)
  }
})

test('keeps the names a file gives its ranges', () => {
  const props = nodeChangeToProps(
    {
      type: 'TEXT',
      fontName: { family: 'Avenir', style: 'Roman', postscript: '' },
      textData: {
        characters: 'Roman Book',
        characterStyleIDs: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
        styleOverrideTable: [
          { styleID: 1, fontName: { family: 'Avenir', style: 'Book', postscript: '' } }
        ]
      }
    } as NodeChange,
    []
  )
  expect(props.styleRuns).toMatchObject([{ start: 6, length: 4, style: { fontStyle: 'Book' } }])
  const written = write(props)
  expect(written.fontName?.style).toBe('Roman')
  expect(written.textData?.styleOverrideTable?.[0]?.fontName?.style).toBe('Book')
  expect(written.derivedTextData?.fontMetaData?.map((meta) => meta.key?.style)).toEqual([
    'Roman',
    'Book'
  ])
})

test('names a face without a name as the font does, and as Google Fonts does without one', () => {
  expect(write({ fontFamily: 'Roboto', fontWeight: 600 }).fontName?.style).toBe('SemiBold')
  expect(write({ fontFamily: 'Roboto', italic: true }).fontName?.style).toBe('Italic')
  expect(write({ fontFamily: 'Roboto', fontWeight: 700, italic: true }).fontName?.style).toBe(
    'Bold Italic'
  )
  const avenir = { ...EMPTY_EXPORT_RUNTIME, fontStyleName: () => 'Book' }
  expect(write({ fontFamily: 'Avenir', fontWeight: 350 }, avenir).fontName?.style).toBe('Book')
})

test('writes Inter under the names of the Inter Figma ships', () => {
  // Figma's Inter 3 spaces the names our Inter 4 joins; Figma finds neither spelling by the other.
  expect(write({ fontFamily: 'Inter', fontWeight: 600 }).fontName?.style).toBe('Semi Bold')
  expect(write({ fontFamily: 'Inter', fontWeight: 800, italic: true }).fontName?.style).toBe(
    'Extra Bold Italic'
  )
  expect(write({ fontFamily: 'Inter', fontStyle: 'SemiBold' }).fontName?.style).toBe('Semi Bold')
  expect(write({ fontFamily: 'Inter', italic: true }).fontName?.style).toBe('Italic')
  expect(write({ fontFamily: 'Inter', fontWeight: 700 }).fontName?.style).toBe('Bold')
})

test('names a range that sets another face without a name by that face, not the text’s name', () => {
  // As HTML or `.pen` import a bold span: a weight and no name.
  const written = write({
    fontFamily: 'Avenir',
    fontStyle: 'Book',
    text: 'Book Bold',
    styleRuns: [{ start: 5, length: 4, style: { fontWeight: 700 } }]
  })
  expect(written.fontName?.style).toBe('Book')
  expect(written.textData?.styleOverrideTable?.[0]?.fontName?.style).toBe('Bold')
})
