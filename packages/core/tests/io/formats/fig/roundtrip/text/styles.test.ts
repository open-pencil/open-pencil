import { beforeAll, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { fontManager } from '@open-pencil/core/text'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

beforeAll(async () => {
  await initCodec()
  const inter = expectDefined(
    await fontManager.fetchBundledFont('/Inter-Regular.ttf'),
    'bundled Inter font'
  )
  fontManager.markLoaded('Inter', 'Regular', inter)
})

test('keeps auto line height on text that mixes font sizes', async () => {
  const graph = new SceneGraph()
  graph.createNode('TEXT', graph.getPages()[0].id, {
    text: 'Small large\nSecond line',
    fontFamily: 'Inter',
    fontSize: 24,
    lineHeight: null,
    width: 300,
    height: 73,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    styleRuns: [
      { start: 6, length: 5, style: { fontSize: 36 } },
      { start: 12, length: 6, style: { textDecoration: 'UNDERLINE' } }
    ]
  })

  const reopened = await parseFigFile((await exportFigFile(graph)).slice().buffer)
  const text = expectDefined(
    [...reopened.getAllNodes()].find((node) => node.type === 'TEXT'),
    'reopened text'
  )
  // Its lines differ in height; fixing both at the first one's cut off the second.
  expect(text.lineHeight).toBeNull()
})

test('keeps its own line height on text whose first line is a range with another', async () => {
  const graph = new SceneGraph()
  for (const lineHeight of [20, null]) {
    graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'First\nSecond',
      fontFamily: 'Inter',
      fontSize: 24,
      lineHeight: 40,
      width: 300,
      height: 60,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      styleRuns: [{ start: 0, length: 6, style: { lineHeight } }]
    })
  }

  const reopened = await parseFigFile((await exportFigFile(graph)).slice().buffer)
  const texts = [...reopened.getAllNodes()].filter((node) => node.type === 'TEXT')
  // Each first line was laid out at its range's line height; the second one has the text's.
  expect(texts.map((text) => [text.lineHeight, text.styleRuns[0]?.style.lineHeight])).toEqual([
    [40, 20],
    [40, null]
  ])
})
