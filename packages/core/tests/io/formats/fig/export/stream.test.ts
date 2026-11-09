import { beforeAll, describe, expect, test } from 'bun:test'
import { unzipSync } from 'fflate'

import {
  exportFigFile,
  exportFigFileStream,
  parseFigFile
} from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { storeImageBytes } from '@open-pencil/test-support/scene'

function graphWithImage(): { graph: SceneGraph; image: Uint8Array } {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const image = new Uint8Array(1024 * 64).map((_, index) => index % 251)
  const hash = storeImageBytes(graph, image)
  graph.createNode('RECTANGLE', page.id, {
    name: 'ImageNode',
    width: 100,
    height: 100,
    fills: [
      {
        type: 'IMAGE',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        imageHash: hash,
        imageScaleMode: 'FILL'
      }
    ]
  })
  return { graph, image }
}

async function collect(write: (sink: (chunk: Uint8Array) => Promise<void>) => Promise<void>) {
  const chunks: Uint8Array[] = []
  await write(async (chunk) => {
    chunks.push(chunk)
  })
  const total = chunks.reduce((length, chunk) => length + chunk.byteLength, 0)
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

describe('streaming fig export', () => {
  beforeAll(async () => {
    await initCodec()
  })

  test('writes the same document as the in-memory export', async () => {
    const { graph, image } = graphWithImage()
    const expected = await exportFigFile(graph, { documentName: 'Streamed' })
    let total = 0
    const seen: number[] = []
    const actual = await collect(async (sink) => {
      await exportFigFileStream(graph, sink, {
        documentName: 'Streamed',
        onProgress(written, bytes) {
          total = bytes
          seen.push(written)
        }
      })
    })

    expect(total).toBe(actual.byteLength)
    expect(seen.at(-1)).toBe(total)
    const expectedGraph = await parseFigFile(expected.buffer as ArrayBuffer)
    const actualGraph = await parseFigFile(actual.buffer as ArrayBuffer)
    expect(actualGraph.nodes.size).toBe(expectedGraph.nodes.size)
    expect(actualGraph.images.size).toBe(expectedGraph.images.size)
    expect(actualGraph.images.values().next().value).toEqual(image)
    const entries = unzipSync(actual)
    expect(entries['canvas.fig']).toBeDefined()
    expect(entries['images/' + [...actualGraph.images.keys()][0]]).toBeDefined()
  })

  test('writes an archive the reader opens', async () => {
    const { graph } = graphWithImage()
    const bytes = await collect(async (sink) => {
      await exportFigFileStream(graph, sink, { documentName: 'Readable' })
    })
    const parsed = await parseFigFile(bytes.buffer as ArrayBuffer)
    expect(parsed.getPages().length).toBeGreaterThan(0)
  })
})
