import { beforeAll, describe, expect, test } from 'bun:test'

import { SceneGraph } from '@lawha/scene-graph'

import { initCanvasKit } from '#cli/headless'
import { SkiaRenderer } from '#core/canvas'
import { RenderChunkIndex, RenderChunkPictureCache } from '#core/canvas/renderer/chunks'

import { expectDefined } from '#tests/helpers/assert'

let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
})

describe('render chunk picture cache', () => {
  test('removes a deleted stale picture before replacement recording can fail', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0], 'page')
    const node = graph.createNode('RECTANGLE', page.id, { width: 20, height: 20 })
    const { index } = RenderChunkIndex.build(graph, page.id)
    const chunk = expectDefined(index.getChunksForNode(node.id)[0], 'chunk')
    const surface = expectDefined(ck.MakeSurface(32, 32), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    const cache = new RenderChunkPictureCache()
    try {
      const stale = cache.get(renderer, graph, chunk)
      renderer.fontGeneration++
      const original = renderer.renderNode
      renderer.renderNode = () => {
        throw new Error('replacement failed')
      }
      expect(() => cache.get(renderer, graph, chunk)).toThrow('replacement failed')
      expect(cache.size()).toBe(0)
      renderer.renderNode = original
      expect(cache.get(renderer, graph, chunk)).not.toBe(stale)
    } finally {
      cache.clear()
      index.dispose()
      renderer.destroy()
    }
  })
})
