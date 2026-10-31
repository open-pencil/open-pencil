import { describe, expect, mock, test } from 'bun:test'

import type { Image as CKImage } from 'canvaskit-wasm'

import {
  planTiles,
  TileImageCache,
  type RenderedTile,
  type TileKey,
  type TilePlanOptions
} from '#core/canvas/renderer/tiles'

import { asDouble } from '../helpers'

function renderedTile(key: TileKey): RenderedTile {
  const image = asDouble<CKImage>({
    width: () => 256,
    height: () => 256,
    delete: mock()
  })
  return {
    key,
    image,
    chunkCount: 1,
    estimatedCost: 1,
    renderMs: 1,
    allocationMs: 0,
    drawMs: 1,
    flushMs: 0,
    snapshotMs: 0
  }
}

function rendered(x: number): RenderedTile {
  return renderedTile({ pageId: 'page', level: 1, x, y: 0 })
}

function baseOptions(overrides: Partial<TilePlanOptions> = {}): TilePlanOptions {
  return {
    pageId: 'page',
    level: 1,
    viewport: { minX: 0, minY: 0, maxX: 1024, maxY: 512 },
    overscanTiles: 0,
    navigationGeneration: 3,
    contentGeneration: 2,
    estimateCost: () => 1,
    ...overrides
  }
}

describe('tile planner', () => {
  test('classifies stale visible jobs before overscan', () => {
    const cache = new TileImageCache()
    cache.install(rendered(0), 1)
    cache.install(rendered(1), 2)
    const plan = planTiles(cache, baseOptions({ overscanTiles: 1 }))

    expect(plan.visible).toHaveLength(2)
    expect(plan.jobs.find((job) => job.key.x === 0)?.priority).toBe('visible')
    expect(plan.jobs.find((job) => job.key.x === 0)?.fallbackAvailable).toBe(true)
    expect(plan.jobs.some((job) => job.key.x === 1 && job.key.y === 0)).toBe(false)
    expect(plan.jobs.some((job) => job.priority === 'overscan')).toBe(false)
    cache.clear()
  })

  test('defers overscan until visible exact coverage is complete', () => {
    const cache = new TileImageCache()
    const options = baseOptions({ overscanTiles: 1 })
    const first = planTiles(cache, options)
    expect(first.jobs.some((job) => job.priority === 'overscan')).toBe(false)

    for (const { key } of first.visible) cache.install(renderedTile(key), options.contentGeneration)
    const covered = planTiles(cache, options)
    expect(covered.jobs.some((job) => job.priority === 'overscan')).toBe(true)
    cache.clear()
  })

  test('marks visible holes mandatory and carries generations', () => {
    const cache = new TileImageCache()
    const plan = planTiles(
      cache,
      baseOptions({
        level: 2,
        viewport: { minX: 0, minY: 0, maxX: 128, maxY: 128 },
        navigationGeneration: 5,
        contentGeneration: 7,
        estimateCost: () => 12
      })
    )

    expect(plan.jobs).toHaveLength(1)
    expect(plan.jobs[0]).toMatchObject({
      priority: 'mandatory',
      fallbackAvailable: false,
      navigationGeneration: 5,
      contentGeneration: 7,
      estimatedCost: 12
    })
  })

  test('plans the coarse backdrop only once the visible level and its overscan are complete', () => {
    const cache = new TileImageCache()
    cache.install(rendered(0), 2)
    const backdrop = { level: 0.25, overscanTiles: 1 }
    const pending = planTiles(cache, baseOptions({ overscanTiles: 1, backdrop }))
    expect(pending.jobs.every((job) => job.key.level === 1)).toBe(true)

    cache.install(rendered(1), 2)
    for (const x of [-1, 2]) cache.install(renderedTile({ pageId: 'page', level: 1, x, y: 0 }), 2)
    for (const x of [-1, 0, 1, 2]) {
      for (const y of [-1, 1]) cache.install(renderedTile({ pageId: 'page', level: 1, x, y }), 2)
    }
    const settled = planTiles(cache, baseOptions({ overscanTiles: 1, backdrop }))
    expect(settled.jobs.length).toBeGreaterThan(0)
    expect(settled.jobs.every((job) => job.key.level === 0.25)).toBe(true)
    expect(settled.jobs.every((job) => job.priority === 'overscan')).toBe(true)
    expect(settled.jobs.every((job) => job.fallbackAvailable)).toBe(true)
    cache.clear()
  })

  test('plans downsample jobs for every tile whose four finer tiles are fresh, one level per frame', () => {
    const cache = new TileImageCache()
    for (const x of [0, 1, 2, 3])
      for (const y of [0, 1]) cache.install(renderedTile({ pageId: 'page', level: 1, x, y }), 2)
    const pyramid = planTiles(
      cache,
      baseOptions({ viewport: { minX: 0, minY: 0, maxX: 1024, maxY: 512 }, pyramid: { levels: 3 } })
    )
    expect(
      pyramid.jobs.map((job) => `${job.kind}:${job.key.level}:${job.key.x}:${job.key.y}`).sort()
    ).toEqual(['downsample:0.5:0:0', 'downsample:0.5:1:0'])
    for (const job of pyramid.jobs) cache.install(renderedTile(job.key), 2)
    const next = planTiles(
      cache,
      baseOptions({ viewport: { minX: 0, minY: 0, maxX: 1024, maxY: 512 }, pyramid: { levels: 3 } })
    )
    // Two level-0.5 tiles side by side are only half of a level-0.25 tile, so nothing more builds.
    expect(next.jobs).toEqual([])
    cache.clear()
  })

  test('orders visible jobs from the viewport centre outward', () => {
    const cache = new TileImageCache()
    const plan = planTiles(
      cache,
      baseOptions({ viewport: { minX: 0, minY: 0, maxX: 1280, maxY: 256 } })
    )
    expect(plan.jobs.map((job) => job.key.x)).toEqual([1, 0, 2])
    cache.clear()
  })

  test('plans the whole page at its coarse level once the visible tiles are fresh', () => {
    const cache = new TileImageCache()
    const pageBackdrop = { level: 0.25, bounds: { minX: 0, minY: 0, maxX: 3000, maxY: 1500 } }
    const pending = planTiles(cache, baseOptions({ overscanTiles: 1, pageBackdrop }))
    expect(pending.jobs.every((job) => job.key.level === 1)).toBe(true)
    cache.install(rendered(0), 2)
    cache.install(rendered(1), 2)
    const page = planTiles(cache, baseOptions({ overscanTiles: 1, pageBackdrop }))
    expect(page.jobs.length).toBe(2 * 1)
    expect(page.jobs.every((job) => job.key.level === 0.25 && job.priority === 'overscan')).toBe(
      true
    )
    cache.clear()
  })
})
