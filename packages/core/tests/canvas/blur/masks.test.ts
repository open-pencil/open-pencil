import { afterAll, describe, expect, test } from 'bun:test'

import { effect, pixelProbes, solid } from '#core-tests/canvas/blur/helpers'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import type { Effect, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())
const { inkArea } = pixelProbes(renderer)

describe('a mask whose drawing reaches past its box', () => {
  const barArea = 100 * 20
  const spreadShadow: Effect = { ...effect('DROP_SHADOW', 0), spread: 10 }
  const shadowedBarArea = (100 + 2 * 10) * (20 + 2 * 10)

  /**
   * Red under `mask`, from a sibling whose own box is a 10px square at `maskedX` and whose child
   * covers the whole frame, so only the mask's bounds can hold the masked-in area.
   */
  function maskedArea(addMask: (graph: SceneGraph, frameId: string) => void, maskedX = 0): number {
    return inkArea((graph, frameId) => {
      addMask(graph, frameId)
      const masked = graph.createNode('FRAME', frameId, {
        x: maskedX,
        width: 10,
        height: 10,
        fills: [],
        clipsContent: false
      })
      graph.createNode('RECTANGLE', masked.id, {
        x: -maskedX,
        width: 400,
        height: 400,
        fills: [solid(1, 0, 0)]
      })
    })
  }

  function barMask(mask: Partial<SceneNode>) {
    return (graph: SceneGraph, frameId: string) => {
      graph.createNode('RECTANGLE', frameId, {
        x: 150,
        y: 190,
        width: 100,
        height: 20,
        fills: [solid(0, 0, 0)],
        isMask: true,
        maskType: 'ALPHA',
        ...mask
      })
    }
  }

  test.each([
    ['turned by 90 degrees', { rotation: 90 }, barArea],
    ['turned by 90 degrees, at 0.9 opacity', { rotation: 90, opacity: 0.9 }, barArea],
    [
      'turned by 90 degrees, with a layer blur',
      { rotation: 90, effects: [effect('LAYER_BLUR', 1)] },
      barArea
    ],
    ['turned by 45 degrees, at 0.9 opacity', { rotation: 45, opacity: 0.9 }, barArea],
    ['with a drop shadow spread past its box', { effects: [spreadShadow] }, shadowedBarArea],
    [
      'turned by 90 degrees, with a drop shadow spread past its box',
      { rotation: 90, effects: [spreadShadow] },
      shadowedBarArea
    ],
    [
      'by luminance, turned by 90 degrees, with a layer blur',
      {
        rotation: 90,
        maskType: 'LUMINANCE' as const,
        fills: [solid(1, 1, 1)],
        effects: [effect('LAYER_BLUR', 1)]
      },
      barArea
    ]
  ])('masks in all it covers, %s', (_, mask, expected) => {
    expect(Math.abs(maskedArea(barMask(mask)) - expected)).toBeLessThanOrEqual(expected * 0.05)
  })

  test.each([
    ['', []],
    [', with a layer blur', [effect('LAYER_BLUR', 1)]]
  ])('masks in all a flipped frame mask covers with a child past its box%s', (_, effects) => {
    const childArea = 100 * 40
    const area = maskedArea((graph, frameId) => {
      const mask = graph.createNode('FRAME', frameId, {
        x: 200,
        y: 100,
        width: 40,
        height: 40,
        fills: [],
        clipsContent: false,
        isMask: true,
        maskType: 'ALPHA',
        flipX: true,
        effects
      })
      graph.createNode('RECTANGLE', mask.id, {
        x: 60,
        width: 100,
        height: 40,
        fills: [solid(0, 0, 1)]
      })
    }, 390)
    expect(Math.abs(area - childArea)).toBeLessThanOrEqual(childArea * 0.05)
  })
})
