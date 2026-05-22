import { describe, test, expect } from 'bun:test'

import { type SceneNode } from '@open-pencil/core'
import { type AbsPosFullInfo } from '@open-pencil/core/canvas'

import { baseLodScreenMetric, effectLodScreenMetric } from '#core/canvas/scene'

// ── LOD screen metric dimensionality tests ──
// LOD thresholds (minScreenSize, minScreenSizeForEffects) are documented
// as area values in px². Metrics MUST return area-equivalent values
// for ALL node types, including LINE nodes whose bounding boxes have
// one near-zero dimension.

function makeLineNode(width: number, height: number): SceneNode {
  return {
    id: 'line-1',
    type: 'LINE',
    name: 'Line',
    width,
    height,
    x: 0,
    y: 0,
    visible: true,
    locked: false,
    opacity: 1,
    fills: [],
    strokes: [],
    effects: [],
    childIds: [],
    rotation: 0
  } as SceneNode
}

function makeRectNode(width: number, height: number): SceneNode {
  return {
    id: 'rect-1',
    type: 'RECTANGLE',
    name: 'Rect',
    width,
    height,
    x: 0,
    y: 0,
    visible: true,
    locked: false,
    opacity: 1,
    fills: [],
    strokes: [],
    effects: [],
    childIds: [],
    rotation: 0
  } as SceneNode
}

const zeroAbsInfo: AbsPosFullInfo = {
  x: 0,
  y: 0,
  boundX: 0,
  boundY: 0,
  width: 0,
  height: 0,
  rotation: 0,
  centerX: 0,
  centerY: 0
}

describe('baseLodScreenMetric — LINE dimensional parity', () => {
  test('LINE metric is in px² (squared length), not px (raw length)', () => {
    // A 60×60 diagonal LINE at 100% zoom.
    // Raw length = max(60, 60) = 60 px.
    // Area-equivalent metric = 60² = 3600 px².
    // A 9×9 rect has area = 81 px².
    // The diagonal line (visual length ≈ 85px) is MORE visible
    // than the 9×9 rect and MUST NOT be culled by a threshold
    // that lets the rect through.
    const line = makeLineNode(60, 60)
    const metric = baseLodScreenMetric(line, null, 1)
    // Metric must be in px² — squaring the screen length
    expect(metric).toBe(3600)
  })

  test('diagonal LINE metric exceeds area-based threshold that near-axis LINE meets', () => {
    const diagonalLine = makeLineNode(60, 60)
    const nearAxisLine = makeLineNode(1000, 0.1)
    const smallRect = makeRectNode(9, 9)

    const diagonalMetric = baseLodScreenMetric(diagonalLine, null, 1)
    const nearAxisMetric = baseLodScreenMetric(
      nearAxisLine,
      { ...zeroAbsInfo, width: 1000, height: 0.1 },
      1
    )
    const rectMetric = baseLodScreenMetric(smallRect, { ...zeroAbsInfo, width: 9, height: 9 }, 1)

    // All metrics must be in px² so a single threshold compares them correctly.
    // nearAxis: max(1000, 0.1) = 1000, squared = 1,000,000 — very visible.
    // The point is: all metrics are in px² and comparable.
    expect(diagonalMetric).toBeGreaterThan(0)
    expect(nearAxisMetric).toBeGreaterThan(0)
    expect(rectMetric).toBeGreaterThan(0)

    // The diagonal line (60×60) should have metric MUCH larger than
    // a threshold of 64 px² (which implies an 8×8 pixel region)
    expect(diagonalMetric).toBeGreaterThan(64)

    // A near-axis 1000×0.1 line should also exceed the threshold
    expect(nearAxisMetric).toBeGreaterThan(64)
  })

  test('horizontal LINE (width > 0, height = 0) produces non-zero area metric', () => {
    const horizontalLine = makeLineNode(100, 0)
    const metric = baseLodScreenMetric(horizontalLine, null, 1)
    // max(100, 0) = 100, squared = 10,000
    expect(metric).toBe(10000)
  })

  test('LINE at low zoom still produces area-equivalent metric', () => {
    const line = makeLineNode(60, 60)
    const metric = baseLodScreenMetric(line, null, 0.25)
    // max(60*0.25, 60*0.25) = 15, squared = 225
    expect(metric).toBe(225)
  })
})

describe('effectLodScreenMetric — LINE dimensional parity', () => {
  test('LINE effect metric is in px² (squared length)', () => {
    const line = makeLineNode(60, 60)
    const metric = effectLodScreenMetric(line, 1)
    expect(metric).toBe(3600)
  })

  test('horizontal LINE effect metric is non-zero area', () => {
    const line = makeLineNode(100, 0)
    const metric = effectLodScreenMetric(line, 1)
    expect(metric).toBe(10000)
  })
})

describe('effectLodScreenMetric — world-space AABB for rotated nodes', () => {
  test('uses world-space AABB dimensions when absInfo is provided', () => {
    // An 8×12 node rotated 45° has AABB ≈ 14.1×14.1 (≈ 199 px²).
    // Without absInfo, the local metric would be 8*12 = 96.
    // With absInfo, the world-space metric should be ~199.
    const node = makeRectNode(8, 12)
    const rotatedAbsInfo: AbsPosFullInfo = {
      x: 0,
      y: 0,
      boundX: -2.83,
      boundY: -2.83,
      width: 14.14,
      height: 14.14,
      rotation: 45,
      centerX: 2.83,
      centerY: 2.83
    }
    const localMetric = effectLodScreenMetric(node, 1)
    const worldMetric = effectLodScreenMetric(node, 1, rotatedAbsInfo)

    // Local metric uses node.width * node.height = 96
    expect(localMetric).toBe(96)
    // World metric uses absInfo.width * absInfo.height ≈ 200
    expect(worldMetric).toBeGreaterThan(190)
    // World metric should be larger than local for a rotated non-square node
    expect(worldMetric).toBeGreaterThan(localMetric)
  })

  test('falls back to local dimensions when absInfo is null', () => {
    const node = makeRectNode(10, 20)
    const nullMetric = effectLodScreenMetric(node, 1, null)
    const undefinedMetric = effectLodScreenMetric(node, 1)
    expect(nullMetric).toBe(200)
    expect(undefinedMetric).toBe(200)
  })
})

describe('baseLodScreenMetric — LINE uses absInfo dimensions', () => {
  test('LINE uses absInfo.width/height for screen length calculation', () => {
    const line = makeLineNode(100, 1)
    // Rotated 90°: AABB width=1, height=100 (swapped)
    const rotatedAbsInfo: AbsPosFullInfo = {
      x: 0,
      y: 0,
      boundX: 0,
      boundY: 0,
      width: 1,
      height: 100,
      rotation: 90,
      centerX: 0.5,
      centerY: 50
    }
    const metric = baseLodScreenMetric(line, rotatedAbsInfo, 1)
    // max(1, 100) = 100, squared = 10000
    expect(metric).toBe(10000)
  })
})

describe('LOD metric zero-AABB fallback consistency', () => {
  test('baseLodScreenMetric and effectLodScreenMetric agree for zero-AABB LINE', () => {
    // When absInfo has width=0, height=0 (legitimately zero-scale parent),
    // both metrics should use the ?? pattern: 0 is a valid value, not
    // "missing data". Both metrics produce 0 — the node is correctly
    // LOD-culled because it takes zero pixels on screen.
    const line = makeLineNode(100, 1)
    const zeroAbs: AbsPosFullInfo = {
      x: 0,
      y: 0,
      boundX: 0,
      boundY: 0,
      width: 0,
      height: 0,
      rotation: 0,
      centerX: 0,
      centerY: 0
    }
    const baseMetric = baseLodScreenMetric(line, zeroAbs, 1)
    const effectMetric = effectLodScreenMetric(line, 1, zeroAbs)
    // Both should agree — both use ?? and preserve 0 as a valid value
    expect(baseMetric).toBe(effectMetric)
    // Both should be 0 for a zero-scale node
    expect(baseMetric).toBe(0)
  })

  test('baseLodScreenMetric and effectLodScreenMetric fall back to local dims when absInfo is null', () => {
    // When absInfo is null/undefined (unit tests outside render pipeline),
    // both metrics should fall back to local node dimensions.
    const line = makeLineNode(100, 1)
    const baseMetric = baseLodScreenMetric(line, null, 1)
    const effectMetric = effectLodScreenMetric(line, 1, null)
    expect(baseMetric).toBe(effectMetric)
    // max(100, 1)² = 10000
    expect(baseMetric).toBe(10000)
  })
})
