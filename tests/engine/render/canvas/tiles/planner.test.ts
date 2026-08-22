import { describe, expect, mock, test } from 'bun:test'

import type { Image as CKImage } from 'canvaskit-wasm'

import { planTiles, TileImageCache, type RenderedTile } from '#core/canvas/renderer/tiles'

function rendered(x: number): RenderedTile {
  const image: Pick<CKImage, 'width' | 'height' | 'delete'> = {
    width: () => 256,
    height: () => 256,
    delete: mock()
  }
  return {
    key: { pageId: 'page', level: 1, x, y: 0 },
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

describe('tile planner', () => {
  test('classifies missing visible, stale visible, and overscan jobs', () => {
    const cache = new TileImageCache()
    cache.install(rendered(0), 1)
    cache.install(rendered(1), 2)
    const plan = planTiles(cache, {
      pageId: 'page',
      level: 1,
      viewport: { minX: 0, minY: 0, maxX: 512, maxY: 256 },
      overscanTiles: 1,
      navigationGeneration: 3,
      contentGeneration: 2,
      estimateCost: () => 1
    })

    expect(plan.visible).toHaveLength(2)
    expect(plan.jobs.find((job) => job.key.x === 0)?.priority).toBe('visible')
    expect(plan.jobs.find((job) => job.key.x === 0)?.fallbackAvailable).toBe(true)
    expect(plan.jobs.some((job) => job.key.x === 1 && job.key.y === 0)).toBe(false)
    expect(plan.jobs.some((job) => job.priority === 'overscan')).toBe(true)
    cache.clear()
  })

  test('marks visible holes mandatory and carries generations', () => {
    const cache = new TileImageCache()
    const plan = planTiles(cache, {
      pageId: 'page',
      level: 2,
      viewport: { minX: 0, minY: 0, maxX: 128, maxY: 128 },
      overscanTiles: 0,
      navigationGeneration: 5,
      contentGeneration: 7,
      estimateCost: () => 12
    })

    expect(plan.jobs).toHaveLength(1)
    expect(plan.jobs[0]).toMatchObject({
      priority: 'mandatory',
      fallbackAvailable: false,
      navigationGeneration: 5,
      contentGeneration: 7,
      estimatedCost: 12
    })
  })
})
