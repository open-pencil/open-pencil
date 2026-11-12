import { expect, test } from 'bun:test'

import { layerTransform, pagePlacement } from '@/app/live-pages/placement'

test('a page covers the whole border box of its frame', () => {
  expect(pagePlacement({ x: 120, y: 40 }, 1440, 900)).toEqual({
    left: 120,
    top: 40,
    width: 1440,
    height: 900
  })
})

test('the layer of pages follows the pan and zoom of the canvas', () => {
  expect(layerTransform({ panX: 24, panY: -8, zoom: 0.5 })).toBe('translate(24px, -8px) scale(0.5)')
})

test('an untransformed canvas leaves the layer at the identity', () => {
  expect(layerTransform({ panX: 0, panY: 0, zoom: 1 })).toBe('translate(0px, 0px) scale(1)')
})
