import { afterAll, describe, expect, test } from 'bun:test'

import { effect, expectFigmaEdge, FIGMA, pixelProbes, solid } from '#core-tests/canvas/blur/helpers'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import type { Effect, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())
const { edgeRow, inkArea } = pixelProbes(renderer)

describe('a layer blur keeps what its node draws past its box', () => {
  const bar = { x: 150, y: 190, width: 100, height: 20, fills: [solid(1, 0, 0)] }

  function frameWithChildPastItsBox(graph: SceneGraph, frameId: string, props: Partial<SceneNode>) {
    const parent = graph.createNode('FRAME', frameId, {
      x: 100,
      y: 100,
      width: 40,
      height: 40,
      fills: [],
      clipsContent: false,
      ...props
    })
    graph.createNode('RECTANGLE', parent.id, {
      x: 60,
      width: 100,
      height: 40,
      fills: [solid(0, 0, 1)]
    })
  }

  const sharp = inkArea((graph, frameId) => frameWithChildPastItsBox(graph, frameId, {}))

  test('a child past the box', () => {
    const blurred = inkArea((graph, frameId) =>
      frameWithChildPastItsBox(graph, frameId, { effects: [effect('LAYER_BLUR', 1)] })
    )
    expect(Math.abs(blurred - sharp)).toBeLessThanOrEqual(sharp * 0.05)
  })

  test('a child past the box, with the node at 0.6 opacity', () => {
    const blurred = inkArea((graph, frameId) =>
      frameWithChildPastItsBox(graph, frameId, {
        opacity: 0.6,
        effects: [effect('LAYER_BLUR', 1)]
      })
    )
    expect(Math.abs(blurred - sharp)).toBeLessThanOrEqual(sharp * 0.05)
  })

  test.each([
    ['with a layer blur', { effects: [effect('LAYER_BLUR', 1)] }],
    ['at 0.6 opacity, with a layer blur', { opacity: 0.6, effects: [effect('LAYER_BLUR', 1)] }]
  ])('a child past the box, with the node flipped, %s', (_, props) => {
    const flipped = { x: 200, flipX: true }
    const blurred = inkArea((graph, frameId) =>
      frameWithChildPastItsBox(graph, frameId, { ...flipped, ...props })
    )
    expect(Math.abs(blurred - sharp)).toBeLessThanOrEqual(sharp * 0.05)
  })

  test('a node turned past its box', () => {
    const turned = (effects: Effect[]) =>
      inkArea((graph, frameId) => {
        graph.createNode('RECTANGLE', frameId, { ...bar, rotation: 90, effects })
      })
    const area = turned([])
    expect(Math.abs(turned([effect('LAYER_BLUR', 1)]) - area)).toBeLessThanOrEqual(area * 0.05)
  })

  test('a child past the box, inside a turned parent', () => {
    const inTurnedParent = (props: Partial<SceneNode>) =>
      inkArea((graph, frameId) => {
        const turned = graph.createNode('FRAME', frameId, {
          x: 200,
          y: 200,
          width: 20,
          height: 20,
          rotation: 90,
          fills: [],
          clipsContent: false
        })
        frameWithChildPastItsBox(graph, turned.id, { x: 0, y: 0, ...props })
      })
    const area = inTurnedParent({})
    const blurred = inTurnedParent({ effects: [effect('LAYER_BLUR', 1)] })
    expect(Math.abs(blurred - area)).toBeLessThanOrEqual(area * 0.05)
  })

  test('a child far past the box, under a 16px layer blur, falls off as in Figma', () => {
    const row = edgeRow((graph, frameId) => {
      const parent = graph.createNode('FRAME', frameId, {
        x: 250,
        y: 100,
        width: 40,
        height: 200,
        fills: [],
        clipsContent: false,
        effects: [effect('LAYER_BLUR', 16)]
      })
      graph.createNode('RECTANGLE', parent.id, {
        x: -150,
        width: 200,
        height: 200,
        fills: [solid(1, 0, 0)]
      })
    }, 3)
    expectFigmaEdge(row, FIGMA['LAYER_BLUR 16'])
  })
})
