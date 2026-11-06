import { expect, test } from 'bun:test'

import { planTiles, TileImageCache } from '#core/canvas/renderer/tiles'

const pageBackdrop = {
  level: 0.5,
  bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 }
}

function options(estimatedCost: number) {
  return {
    pageId: 'page',
    level: 1,
    // A zero-area viewport has no visible or overscan tiles, leaving the page copy alone in the plan.
    viewport: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    overscanTiles: 0,
    navigationGeneration: 0,
    contentGeneration: 0,
    estimateCost: () => estimatedCost,
    globalFallbackAvailable: true,
    pageBackdrop
  }
}

test('skips a page backdrop whose tiles are too dear for an idle frame', () => {
  const plan = planTiles(new TileImageCache(), options(100))

  expect(plan.jobs).toEqual([])
})

test('still builds a page backdrop whose tiles are cheap', () => {
  const plan = planTiles(new TileImageCache(), options(1))

  expect(plan.jobs).toHaveLength(1)
  expect(plan.jobs[0]?.priority).toBe('overscan')
})

test('keeps a background tile exactly at the idle-frame limit', () => {
  const plan = planTiles(new TileImageCache(), options(32))

  expect(plan.jobs).toHaveLength(1)
})

test('never drops a visible tile for its estimated cost', () => {
  const plan = planTiles(new TileImageCache(), {
    ...options(100),
    pageBackdrop: undefined,
    viewport: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 }
  })

  expect(plan.jobs.length).toBeGreaterThan(0)
  expect(plan.jobs.every((job) => job.priority === 'visible' || job.priority === 'mandatory')).toBe(
    true
  )
})

test('skips overscan and backdrop tiles too dear for an idle frame', () => {
  const plan = planTiles(new TileImageCache(), {
    ...options(100),
    pageBackdrop: undefined,
    overscanTiles: 1
  })

  expect(plan.jobs).toEqual([])
})
