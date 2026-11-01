import { beforeAll, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SceneGraph } from '@open-pencil/scene-graph'
import { pixelLength } from '@open-pencil/scene-graph/text'

import { BUILTIN_IO_FORMATS, IORegistry } from '#core/io'
import { fontManager } from '#core/text/font/manager'

const SENTENCE = 'A sentence long enough that it has to wrap onto a second line.'

beforeAll(async () => {
  const inter = expectDefined(await fontManager.fetchBundledFont('/InterVariable.ttf'), 'Inter')
  await fontManager.markLoaded('Inter', 'Regular', inter)
})

test('an SVG export sets text on the canvas baselines, a wrapped paragraph on its lines', async () => {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const node = graph.createNode('TEXT', pageId, {
    text: SENTENCE,
    fontFamily: 'Inter',
    fontSize: 13,
    lineHeight: pixelLength(24),
    width: 230,
    height: 48,
    textAutoResize: 'HEIGHT'
  })
  const io = new IORegistry(BUILTIN_IO_FORMATS)
  const result = await io.exportContent('svg', {
    graph,
    target: { scope: 'node', nodeId: node.id }
  })
  if (typeof result.data !== 'string') throw new Error('Expected SVG markup')
  const baselines = [...result.data.matchAll(/<tspan [^>]*y="([\d.]+)"/g)].map(([, y]) => Number(y))
  // Two 24 px lines, each baseline below half the leading and the font's ascent, not at 13.
  expect(baselines).toHaveLength(2)
  expect(baselines[0]).toBeGreaterThan(13)
  expect(baselines[1] - baselines[0]).toBeCloseTo(24)
})
