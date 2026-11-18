import { afterEach, expect, test } from 'bun:test'

import { unzipSync } from 'fflate'

import {
  exportFigFile,
  setFigCanvasCompressor,
  type FigCanvasParts
} from '@open-pencil/core/io/formats/fig'
import { SceneGraph } from '@open-pencil/scene-graph'
import { storeImageBytes } from '@open-pencil/test-support/scene'

import { buildFigCanvas } from '#core/io/formats/fig/export/compress'

afterEach(() => setFigCanvasCompressor(null))

function boardWithImage() {
  const graph = new SceneGraph()
  graph.documentKind = 'board'
  const image = new Uint8Array(4096).map((_, index) => index % 251)
  graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    name: 'Card',
    width: 40,
    height: 20,
    fills: [
      {
        type: 'IMAGE',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        imageHash: storeImageBytes(graph, image),
        imageScaleMode: 'FILL'
      }
    ]
  })
  return { graph, image }
}

test('a host compressor gets only the document data, and the archive is written around it', async () => {
  const { graph, image } = boardWithImage()
  const received: FigCanvasParts[] = []
  let canvas: Uint8Array = new Uint8Array()
  setFigCanvasCompressor(async (parts) => {
    received.push(parts)
    canvas = await buildFigCanvas(parts)
    return canvas
  })

  const entries = unzipSync(await exportFigFile(graph, { documentName: 'Board' }))

  expect(received).toHaveLength(1)
  expect(received[0].kind).toBe('board')
  expect(Object.keys(received[0]).sort()).toEqual(
    ['compressionLevel', 'figKiwiVersion', 'kind', 'kiwiData', 'schemaDeflated'].sort()
  )
  expect([...entries['canvas.fig']]).toEqual([...canvas])
  const images = Object.keys(entries).filter((name) => name.startsWith('images/'))
  expect(images.map((name) => entries[name])).toEqual([image])
})

test('without a host the export compresses the document data itself', async () => {
  const entries = unzipSync(await exportFigFile(new SceneGraph()))
  expect(new TextDecoder().decode(entries['canvas.fig'].subarray(0, 8))).toBe('fig-kiwi')
})
