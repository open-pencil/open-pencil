import { expect, test } from 'bun:test'

import { renderNodesToPPTX } from '@open-pencil/core/io'
import { expectDefined } from '@open-pencil/test-support/assert'

import { makeGraph, makeSlideFrame, pageId, slideXML, stubRasterize, unzipPPTX } from './helpers'

test.each([
  ['empty', []],
  ['hidden', [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: false }]]
] as const)('a run whose fills are %s is written invisible', async (_, runFills) => {
  const graph = makeGraph()
  const frame = makeSlideFrame(graph, 'Slide')
  graph.createNode('TEXT', frame.id, {
    text: 'Hello PPTX',
    width: 400,
    height: 60,
    x: 100,
    y: 100,
    fontSize: 32,
    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
    styleRuns: [{ start: 6, length: 4, style: { fills: [...runFills] } }]
  })
  const data = await renderNodesToPPTX(graph, pageId(graph), [frame.id], {
    rasterize: stubRasterize
  })
  const xml = slideXML(unzipPPTX(expectDefined(data, 'PPTX data')), 1)
  const run = expectDefined(/<a:r>(?:(?!<\/a:r>).)*PPTX<\/a:t><\/a:r>/s.exec(xml)?.[0], 'PPTX run')
  expect(run).toContain('<a:alpha val="0"/>')
  expect(run).not.toContain('FF0000')
})
