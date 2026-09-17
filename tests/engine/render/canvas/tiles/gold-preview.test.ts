import { beforeAll, expect, setDefaultTimeout, test } from 'bun:test'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { initCanvasKit } from '#cli/headless'
import { SkiaRenderer } from '#core/canvas'
import { RenderChunkIndex, RenderChunkPictureCache } from '#core/canvas/renderer/chunks'
import {
  deleteRenderedTile,
  renderTile,
  tileChunks,
  tileLevel,
  TileSurfacePool
} from '#core/canvas/renderer/tiles'

import { expectDefined } from '#tests/helpers/assert'
import { sharedGoldPreviewFixture } from '#tests/helpers/fig-fixtures'
import { HEAVY_TEST_TIMEOUT_MS } from '#tests/helpers/test-utils'

setDefaultTimeout(HEAVY_TEST_TIMEOUT_MS)

let graph: SceneGraph
let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
  graph = (await sharedGoldPreviewFixture()).graph
}, 60_000)

test('renders one gold-preview tile from a selective chunk query', () => {
  const page = expectDefined(graph.getPages()[0], 'gold-preview page')
  const root = expectDefined(graph.getChildren(page.id)[0], 'gold-preview root')
  const { index } = RenderChunkIndex.build(graph, page.id)
  const surface = expectDefined(ck.MakeSurface(320, 240), 'tile benchmark surface')
  const renderer = new SkiaRenderer(ck, surface)
  const pictureCache = new RenderChunkPictureCache()
  const surfacePool = new TileSurfacePool()
  try {
    const level = tileLevel(1)
    const worldSize = 256 / level
    const key = {
      pageId: page.id,
      level,
      x: Math.floor(root.x / worldSize),
      y: Math.floor(root.y / worldSize)
    }
    const cold = expectDefined(
      renderTile(renderer, graph, index, key, pictureCache, surfacePool),
      'cold tile'
    )
    const warm = expectDefined(
      renderTile(renderer, graph, index, key, pictureCache, surfacePool),
      'warm tile'
    )

    expect(cold.chunkCount).toBeLessThan(index.size())
    expect(tileChunks(index, key)).toHaveLength(cold.chunkCount)
    expect(pictureCache.size()).toBeGreaterThan(0)
    deleteRenderedTile(cold)
    deleteRenderedTile(warm)
  } finally {
    surfacePool.clear()
    pictureCache.clear()
    index.dispose()
    renderer.destroy()
  }
})
