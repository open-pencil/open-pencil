import { beforeAll, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { exportFigFile, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'
import { fontManager } from '@open-pencil/core/text'
import { parseFigBuffer } from '@open-pencil/fig'
import type { TextParagraphStyle } from '@open-pencil/scene-graph'

const LIST: TextParagraphStyle[] = [
  { listType: 'NONE', indentation: 0, paragraphSpacing: 24, paragraphIndent: 30 },
  { listType: 'ORDERED', indentation: 1, listSpacing: 2 },
  { listType: 'ORDERED', indentation: 2 },
  { listType: 'UNORDERED', indentation: 1 }
]

beforeAll(async () => {
  await initCodec()
  const inter = expectDefined(
    await fontManager.fetchBundledFont('/Inter-Regular.ttf'),
    'bundled Inter font'
  )
  fontManager.markLoaded('Inter', 'Regular', inter)
})

test('writes lists as Figma does and reads them back', async () => {
  const graph = new SceneGraph()
  graph.createNode('TEXT', graph.getPages()[0].id, {
    text: 'Intro\nFirst\nNested\nBullet',
    fontFamily: 'Inter',
    fontSize: 16,
    width: 300,
    height: 100,
    textParagraphs: LIST,
    listSpacing: 6,
    paragraphSpacing: 10,
    paragraphIndent: 12,
    hangingList: true
  })
  const bytes = await exportFigFile(graph)

  const written = expectDefined(
    parseFigBuffer(bytes.slice().buffer).nodeChanges.find((node) => node.type === 'TEXT'),
    'written text'
  )
  expect(
    written.textData?.lines?.map((line) => [
      line.lineType,
      line.indentationLevel,
      line.isFirstLineOfList
    ])
  ).toEqual([
    ['PLAIN', 0, false],
    ['ORDERED_LIST', 1, true],
    ['ORDERED_LIST', 2, true],
    ['UNORDERED_LIST', 1, true]
  ])
  expect([
    written.listSpacing,
    written.paragraphSpacing,
    written.paragraphIndent,
    written.hangingList
  ]).toEqual([6, 10, 12, true])
  // Figma draws pasted and opened text from these glyphs: each marker is one with no character.
  const markers = written.derivedTextData?.glyphs?.filter((glyph) => glyph.firstCharacter === undefined)
  expect(markers?.length).toBe(5)

  const reopened = await parseFigFile(bytes.slice().buffer)
  const text = expectDefined(
    [...reopened.getAllNodes()].find((node) => node.type === 'TEXT'),
    'reopened text'
  )
  expect(text.textParagraphs).toEqual(LIST)
  expect([text.listSpacing, text.paragraphSpacing, text.paragraphIndent, text.hangingList]).toEqual([
    6, 10, 12, true
  ])
})
