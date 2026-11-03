import { beforeAll, expect, test } from 'bun:test'
import { join } from 'node:path'

import { expectDefined } from '#core-tests/helpers/assert'
import { FIXTURES } from '#core-tests/helpers/paths'

import { buildFigmaClipboardHTML, importClipboardNodes } from '@open-pencil/core/clipboard'
import { parseFigmaClipboard } from '@open-pencil/fig/clipboard'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

/**
 * A vector as Figma copies it, with three regions: red of its own, the layer's grey, and an empty
 * fill list. Figma's copy writes no fill geometry, so the regions alone carry their paints.
 */
const FIXTURE = join(FIXTURES, 'clipboard/vector-region-fills.html')

async function pasted(html: string): Promise<{ graph: SceneGraph; vector: SceneNode }> {
  const parsed = expectDefined(await parseFigmaClipboard(html))
  const graph = new SceneGraph()
  importClipboardNodes(parsed.nodes, graph, graph.getPages()[0].id, 0, 0, parsed.blobs)
  const vector = expectDefined([...graph.nodes.values()].find((node) => node.type === 'VECTOR'))
  return { graph, vector }
}

const regionColors = (vector: SceneNode) =>
  vector.vectorNetwork?.regions.map((region) => region.fills?.map((fill) => fill.color))

beforeAll(initCodec)

test("a pasted vector keeps each region's own paints", async () => {
  const { vector } = await pasted(await Bun.file(FIXTURE).text())
  expect(regionColors(vector)).toEqual([[{ r: 1, g: 0, b: 0, a: 1 }], undefined, []])
  expect(vector.fills[0]?.color).toEqual({ r: 0.5, g: 0.5, b: 0.5, a: 1 })
})

test('region paints survive our own copy and paste', async () => {
  const { graph, vector } = await pasted(await Bun.file(FIXTURE).text())
  const html = expectDefined(await buildFigmaClipboardHTML([vector], graph))
  expect(regionColors((await pasted(html)).vector)).toEqual(regionColors(vector))
})

/**
 * A vector as Figma copies it, a red region filled from a paint style and a blue one of its own.
 * Figma's copy names the style in the region's style table entry and writes no paints there.
 */
const STYLED_FIXTURE = join(FIXTURES, 'clipboard/vector-region-style.html')

/** Each region's colour and the name of the paint style it comes from. */
function regionStyles(graph: SceneGraph, vector: SceneNode) {
  return vector.vectorNetwork?.regions.map((region) => ({
    color: region.fills?.[0]?.color,
    style: [...graph.nodes.values()].find((node) => node.source.id === region.fillStyleId)?.name
  }))
}

const STYLED_REGIONS = [
  { color: { r: 1, g: 0, b: 0, a: 1 }, style: 'OP oracle region style' },
  { color: { r: 0, g: 0, b: 1, a: 1 }, style: undefined }
]

test("a pasted vector's region takes the paints of the style it names", async () => {
  const { graph, vector } = await pasted(await Bun.file(STYLED_FIXTURE).text())
  expect(regionStyles(graph, vector)).toEqual(STYLED_REGIONS)
})
