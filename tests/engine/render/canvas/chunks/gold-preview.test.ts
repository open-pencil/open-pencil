import { beforeAll, expect, setDefaultTimeout, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import { initCodec, parseFigFile } from '@open-pencil/core'

import { RenderChunkIndex } from '#core/canvas/renderer/chunks'

import { expectDefined } from '#tests/helpers/assert'
import { repoPath } from '#tests/helpers/paths'
import { HEAVY_TEST_TIMEOUT_MS } from '#tests/helpers/test-utils'

setDefaultTimeout(HEAVY_TEST_TIMEOUT_MS)

let graph: Awaited<ReturnType<typeof parseFigFile>>

beforeAll(async () => {
  await initCodec()
  const bytes = readFileSync(repoPath('tests/fixtures/gold-preview.fig'))
  graph = await parseFigFile(bytes.buffer as ArrayBuffer, { populate: 'all' })
}, 60_000)

test('gold-preview render chunks stay bounded and spatial queries stay selective', () => {
  const page = expectDefined(graph.getPages()[0], 'gold-preview page')
  const buildStartedAt = performance.now()
  const { index, stats } = RenderChunkIndex.build(graph, page.id)
  const buildMs = performance.now() - buildStartedAt

  const bounds = graph.getChildren(page.id)[0]
  const queryStartedAt = performance.now()
  const found = bounds
    ? index.search({
        minX: bounds.x,
        minY: bounds.y,
        maxX: bounds.x + Math.min(bounds.width, 1_000),
        maxY: bounds.y + Math.min(bounds.height, 800)
      })
    : []
  const queryMs = performance.now() - queryStartedAt

  console.debug(
    JSON.stringify({
      nodesVisited: stats.nodesVisited,
      chunksBuilt: stats.chunksBuilt,
      maximumChunkNodes: stats.maximumChunkNodes,
      maximumAtomicChunkNodes: stats.maximumAtomicChunkNodes,
      oversizedAtomicChunks: stats.oversizedAtomicChunks,
      buildMs,
      queryResults: found.length,
      queryMs
    })
  )

  expect(stats.nodesVisited).toBeGreaterThan(300)
  expect(stats.maximumChunkNodes).toBeLessThanOrEqual(32)
  expect(stats.chunksBuilt).toBeLessThan(stats.nodesVisited)
  expect(stats.oversizedAtomicChunks).toBe(0)
  expect(found.length).toBeLessThan(stats.chunksBuilt)
  expect(buildMs).toBeLessThan(1_000)
  expect(queryMs).toBeLessThan(20)
  index.dispose()
})
