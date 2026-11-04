import { describe, expect, setDefaultTimeout, test } from 'bun:test'

import { unzipSync } from 'fflate'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { parseFigKiwiChunks } from '@open-pencil/kiwi/fig/container'
import { OPEN_PENCIL_PLUGIN_DATA, withPluginData } from '@open-pencil/scene-graph/plugin-data'
import type { FigCompression } from '@open-pencil/scene-graph/fig-compression'

import { figCompressionOf } from '#core/io/formats/fig/compression'
import { hasPendingReaderPages } from '#core/kiwi/fig/session/document-state'

setDefaultTimeout(60_000)

/** A document with enough layers for compression levels to differ. */
function sampleDocument(): SceneGraph {
  const graph = new SceneGraph()
  const [page] = graph.getPages()
  for (let index = 0; index < 400; index++) {
    graph.createNode('RECTANGLE', page.id, {
      name: `Layer ${index % 37}`,
      x: (index * 13) % 900,
      y: (index * 29) % 700,
      width: 10 + (index % 11),
      height: 10 + (index % 7)
    })
  }
  graph.addPage('Second')
  return graph
}

function setCompression(graph: SceneGraph, compression: FigCompression) {
  const root = graph.getNode(graph.rootId)
  if (!root) throw new Error('Missing document node')
  graph.updateNode(graph.rootId, {
    pluginData: withPluginData(root.pluginData, OPEN_PENCIL_PLUGIN_DATA.figCompression, compression)
  })
}

/** The compressed document data inside a `.fig` archive. */
function dataChunk(bytes: Uint8Array): Uint8Array {
  const chunk = parseFigKiwiChunks(unzipSync(bytes)['canvas.fig'])?.[1]
  if (!chunk) throw new Error('Missing document data')
  return chunk
}

const open = (bytes: Uint8Array, populate: 'all' | 'first-page' = 'all') =>
  parseFigFile(bytes.slice().buffer as ArrayBuffer, { populate })

describe('.fig compression', () => {
  test('a new document is written at its compression and keeps it', async () => {
    await initCodec()
    const fast = sampleDocument()
    const smallest = sampleDocument()
    setCompression(smallest, 'smallest')
    const fastBytes = await exportFigFile(fast)
    const smallestBytes = await exportFigFile(smallest)
    expect(dataChunk(smallestBytes).length).toBeLessThan(dataChunk(fastBytes).length)
    expect(figCompressionOf(await open(smallestBytes))).toBe('smallest')
  })

  test('an opened document is patched at the compression it was changed to', async () => {
    await initCodec()
    const original = await exportFigFile(sampleDocument())
    const fast = await open(original, 'first-page')
    const smallest = await open(original, 'first-page')
    setCompression(smallest, 'smallest')
    fast.createNode('RECTANGLE', fast.getPages()[0].id, { name: 'Edit' })
    const fastBytes = await exportFigFile(fast)
    const smallestBytes = await exportFigFile(smallest)
    // Saved over the archive they were opened from: the pages never opened are still pending.
    expect(hasPendingReaderPages(fast)).toBe(true)
    expect(hasPendingReaderPages(smallest)).toBe(true)
    expect(dataChunk(smallestBytes).length).toBeLessThan(dataChunk(fastBytes).length)
    expect(figCompressionOf(await open(smallestBytes))).toBe('smallest')
  })
})
