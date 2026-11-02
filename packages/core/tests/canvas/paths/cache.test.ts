import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import type { Path } from 'canvaskit-wasm'

import { SceneGraph, type Stroke } from '@open-pencil/scene-graph'

import { SkiaRenderer } from '#core/canvas'
import { createPathCache, NodePathCaches } from '#core/canvas/paths/cache'
import { render, renderSceneToCanvas } from '#core/canvas/renderer/pipeline'
import { initCanvasKit } from '#core/io/formats/raster/headless'

const ck = await initCanvasKit()

function linePath(points: number): Path {
  const builder = new ck.PathBuilder()
  builder.moveTo(0, 0)
  for (let i = 1; i < points; i++) builder.lineTo(i, i % 2)
  return builder.detachAndDelete()
}

const STROKE: Stroke = {
  type: 'SOLID',
  color: { r: 0, g: 0, b: 0, a: 1 },
  weight: 1,
  opacity: 1,
  visible: true,
  align: 'CENTER'
}

function triangles(count: number, strokes: Stroke[] = []) {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'default page')
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    const node = graph.createNode('VECTOR', page.id, {
      x: (i % 20) * 10,
      y: Math.floor(i / 20) * 10,
      width: 8,
      height: 8,
      fills: [
        { type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8, a: 1 }, opacity: 1, visible: true }
      ],
      strokes,
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 8, y: 0 },
          { x: 8, y: 8 }
        ],
        segments: [0, 1, 2].map((start) => ({
          start,
          end: (start + 1) % 3,
          tangentStart: { x: 0, y: 0 },
          tangentEnd: { x: 0, y: 0 }
        })),
        regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
      }
    })
    ids.push(node.id)
  }
  return { graph, pageId: page.id, ids }
}

function withRenderer(pageId: string, run: (renderer: SkiaRenderer) => void) {
  const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(256, 256), 'surface'))
  renderer.viewportWidth = 256
  renderer.viewportHeight = 256
  renderer.pageId = pageId
  renderer.pageColor = { r: 1, g: 1, b: 1, a: 1 }
  try {
    run(renderer)
  } finally {
    renderer.destroy()
  }
}

describe('path cache', () => {
  test('evicts the least recently used paths by point count and deletes them', () => {
    const cache = createPathCache({ maxPoints: 40 })
    const [a, b, c] = [linePath(10), linePath(10), linePath(10)]
    cache.set('a', [a])
    cache.set('b', [b])
    cache.get('a')
    cache.set('c', [c])
    expect(cache.weight).toBeLessThanOrEqual(40)
    expect([...cache].map(([key]) => key)).toEqual(['a', 'c'])
    expect(b.isDeleted()).toBe(true)
    expect(a.isDeleted()).toBe(false)
    cache.clear()
    expect(a.isDeleted() && c.isDeleted()).toBe(true)
  })

  test('keeps paths larger than a cache until they are released', () => {
    const paths = new NodePathCaches({ maxPoints: 20 })
    const huge = linePath(50)
    paths.store(paths.vector, 'huge', [huge])
    expect(paths.vector.has('huge')).toBe(false)
    expect(huge.isDeleted()).toBe(false)
    paths.releaseUncached()
    expect(huge.isDeleted()).toBe(true)
  })
})

describe('renderer path caches', () => {
  test('stay within their point budget however many vectors are drawn', () => {
    const { graph, pageId } = triangles(200)
    withRenderer(pageId, (renderer) => {
      renderer.nodePaths = new NodePathCaches({ maxPoints: 400 })
      const earliest = [linePath(4)]
      renderer.nodePaths.vector.set('earliest', earliest)
      render(renderer, graph, new Set(), {}, 1, 'scene', true)
      expect(renderer.nodePaths.vector.size).toBeGreaterThan(0)
      expect(renderer.nodePaths.vector.weight).toBeLessThanOrEqual(400)
      expect(earliest.every((path) => path.isDeleted())).toBe(true)
    })
  })

  test('invalidating a vector deletes every path built for it and keeps the others', () => {
    const { pageId, ids } = triangles(2, [STROKE])
    const [edited, other] = ids
    withRenderer(pageId, (renderer) => {
      const { vector, vectorStroke, strokeOutline, fillGeometry, strokeGeometry } =
        renderer.nodePaths
      const caches = [vector, vectorStroke, strokeOutline, fillGeometry, strokeGeometry]
      const built = caches.map((cache) => {
        const paths = [linePath(3)]
        cache.set(cache === strokeOutline ? `${edited}|runs|1|NONE` : edited, paths)
        cache.set(other, [linePath(3)])
        return paths
      })
      renderer.invalidateVectorPath(edited)
      for (const cache of caches) expect([...cache].map(([key]) => key)).toEqual([other])
      expect(built.flat().every((path) => path.isDeleted())).toBe(true)
    })
  })

  test('stroke outlines of filled vectors are built once and reused by later frames', () => {
    const { graph, pageId } = triangles(3, [STROKE])
    withRenderer(pageId, (renderer) => {
      render(renderer, graph, new Set(), {}, 1, 'scene', true)
      const outlines = [...renderer.nodePaths.strokeOutline.values()].flat()
      expect(outlines).toHaveLength(3)
      renderer.invalidateAllPictures()
      render(renderer, graph, new Set(), {}, 2, 'scene', true)
      expect([...renderer.nodePaths.strokeOutline.values()].flat()).toEqual(outlines)
      expect(outlines.some((path) => path.isDeleted())).toBe(false)
    })
  })

  test('an export releases the paths earlier drawing could not cache', () => {
    const { graph, pageId } = triangles(1)
    withRenderer(pageId, (renderer) => {
      renderer.nodePaths = new NodePathCaches({ maxPoints: 20 })
      const huge = linePath(50)
      renderer.nodePaths.store(renderer.nodePaths.fillGeometry, 'huge', [huge])
      renderSceneToCanvas(renderer, renderer.surface.getCanvas(), graph, pageId)
      expect(huge.isDeleted()).toBe(true)
    })
  })
})
