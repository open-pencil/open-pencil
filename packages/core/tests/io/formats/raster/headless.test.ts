import { expect, test } from 'bun:test'

import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type VectorNetwork } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { exportFigFile, parseFigFile } from '#core/io/formats/fig'
import { exportPDFDocument } from '#core/io/formats/pdf'
import { headlessRenderNodes } from '#core/io/formats/raster'

const SIZE = 40
const straight = { tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }

function closedNetwork(corners: Vector[]): VectorNetwork {
  return {
    vertices: corners,
    segments: corners.map((_, index) => ({
      start: index,
      end: (index + 1) % corners.length,
      ...straight
    })),
    regions: [{ windingRule: 'NONZERO', loops: [corners.map((_, index) => index)] }]
  }
}

const SQUARE = closedNetwork([
  { x: 0, y: 0 },
  { x: SIZE, y: 0 },
  { x: SIZE, y: SIZE },
  { x: 0, y: SIZE }
])
const TRIANGLE = closedNetwork([
  { x: 0, y: SIZE },
  { x: SIZE / 2, y: 0 },
  { x: SIZE, y: SIZE }
])

/** A saved document with one vector, which every copy read from it gives the same id. */
const saved = await (async () => {
  await initCodec()
  const graph = new SceneGraph()
  graph.createNode('VECTOR', graph.getPages()[0].id, {
    width: SIZE,
    height: SIZE,
    vectorNetwork: SQUARE,
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
  })
  return exportFigFile(graph)
})()

/** A copy of the saved document with its vector drawn as `network`. */
async function vector(network: VectorNetwork) {
  const graph = await parseFigFile(saved.slice().buffer)
  const pageId = graph.getPages()[0].id
  const [node] = graph.getChildren(pageId)
  graph.updateNode(node.id, { vectorNetwork: network })
  return { graph, pageId, nodeIds: [node.id] }
}

type Layer = Awaited<ReturnType<typeof vector>>

test('PNG exports of different documents at once draw their own vectors', async () => {
  const png = ({ graph, pageId, nodeIds }: Layer) =>
    headlessRenderNodes(graph, pageId, nodeIds, { useAbsoluteBounds: true })
  const alone = [await png(await vector(SQUARE)), await png(await vector(TRIANGLE))]
  expect(alone[0]).not.toEqual(alone[1])
  // Both documents are read first, so the two exports start in the same step and overlap.
  const [square, triangle] = await Promise.all([vector(SQUARE), vector(TRIANGLE)])
  expect(await Promise.all([png(square), png(triangle)])).toEqual([alone[0], alone[1]])
})

test('PDF exports of different documents at once draw their own vectors', async () => {
  const pdf = async ({ graph, pageId, nodeIds }: Layer) =>
    (await exportPDFDocument(graph, [{ pageId, nodeIds }]))?.data
  const alone = [await pdf(await vector(SQUARE)), await pdf(await vector(TRIANGLE))]
  expect(alone[0]).not.toEqual(alone[1])
  // Both documents are read first, so the two exports start in the same step and overlap.
  const [square, triangle] = await Promise.all([vector(SQUARE), vector(TRIANGLE)])
  expect(await Promise.all([pdf(square), pdf(triangle)])).toEqual([alone[0], alone[1]])
})
