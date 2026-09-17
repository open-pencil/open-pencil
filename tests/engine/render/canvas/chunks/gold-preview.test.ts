import { beforeAll, expect, setDefaultTimeout, test } from 'bun:test'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { RenderChunkIndex } from '#core/canvas/renderer/chunks'

import { expectDefined } from '#tests/helpers/assert'
import { sharedGoldPreviewFixture } from '#tests/helpers/fig-fixtures'
import { HEAVY_TEST_TIMEOUT_MS } from '#tests/helpers/test-utils'

setDefaultTimeout(HEAVY_TEST_TIMEOUT_MS)

let graph: SceneGraph

beforeAll(async () => {
  graph = (await sharedGoldPreviewFixture()).graph
}, 60_000)

test('gold-preview render chunks stay bounded and spatial queries stay selective', () => {
  const page = expectDefined(graph.getPages()[0], 'gold-preview page')
  const { index, stats } = RenderChunkIndex.build(graph, page.id)

  const bounds = graph.getChildren(page.id)[0]
  const found = bounds
    ? index.search({
        minX: bounds.x,
        minY: bounds.y,
        maxX: bounds.x + Math.min(bounds.width, 1_000),
        maxY: bounds.y + Math.min(bounds.height, 800)
      })
    : []

  expect(stats.nodesVisited).toBeGreaterThan(300)
  expect(stats.maximumChunkNodes).toBeLessThanOrEqual(32)
  expect(stats.chunksBuilt).toBeLessThan(stats.nodesVisited)
  expect(stats.oversizedAtomicChunks).toBe(0)
  expect(found.length).toBeLessThan(stats.chunksBuilt)
  index.dispose()
})
