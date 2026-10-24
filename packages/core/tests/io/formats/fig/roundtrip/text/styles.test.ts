import { beforeAll, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { fontManager } from '@open-pencil/core/text'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

beforeAll(async () => {
  await initCodec()
  const inter = expectDefined(
    await fontManager.fetchBundledFont('/InterVariable.ttf'),
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
