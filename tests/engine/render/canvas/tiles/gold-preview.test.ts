import { beforeAll, expect, setDefaultTimeout, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import { initCodec, parseFigFile } from '@open-pencil/core'

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
import { repoPath } from '#tests/helpers/paths'
import { HEAVY_TEST_TIMEOUT_MS } from '#tests/helpers/test-utils'

setDefaultTimeout(HEAVY_TEST_TIMEOUT_MS)

let graph: Awaited<ReturnType<typeof parseFigFile>>
let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
  await initCodec()
  const bytes = readFileSync(repoPath('tests/fixtures/gold-preview.fig'))
  graph = await parseFigFile(bytes.buffer as ArrayBuffer, { populate: 'all' })
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
    const cold = renderTile(renderer, graph, index, key, pictureCache, surfacePool)
    const warm = renderTile(renderer, graph, index, key, pictureCache, surfacePool)
    console.debug(
      JSON.stringify({
        indexChunks: index.size(),
        tileChunks: cold.chunkCount,
        estimatedCost: cold.estimatedCost,
        coldRenderMs: cold.renderMs,
        warmRenderMs: warm.renderMs,
        warmPhases: {
          allocationMs: warm.allocationMs,
          drawMs: warm.drawMs,
          flushMs: warm.flushMs,
          snapshotMs: warm.snapshotMs
        },
        cachedPictures: pictureCache.size(),
        chunks: tileChunks(index, key).map((chunk) => ({
          id: chunk.id,
          kind: chunk.kind,
          interruptible: chunk.interruptible,
          nodeCount: chunk.nodeCount,
          estimatedCost: chunk.estimatedCost,
          node: (() => {
            const node = graph.getNode(chunk.nodeId)
            return node
              ? {
                  type: node.type,
                  name: node.name,
                  opacity: node.opacity,
                  blendMode: node.blendMode,
                  effects: node.effects
                    .filter((effect) => effect.visible)
                    .map((effect) => effect.type),
                  children: node.childIds.length
                }
              : null
          })()
        }))
      })
    )

    expect(cold.chunkCount).toBeLessThan(index.size())
    expect(cold.renderMs).toBeLessThan(50)
    expect(warm.renderMs).toBeLessThan(cold.renderMs)
    deleteRenderedTile(cold)
    deleteRenderedTile(warm)
  } finally {
    surfacePool.clear()
    pictureCache.clear()
    index.dispose()
    renderer.destroy()
  }
})
