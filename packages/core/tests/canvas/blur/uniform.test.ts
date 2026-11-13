import { afterAll, describe, expect, test } from 'bun:test'

import { effect, expectFigmaEdge, FIGMA, pixelProbes, solid } from '#core-tests/canvas/blur/helpers'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { maxOf } from '@open-pencil/scene-graph/arrays'
import { expectDefined } from '@open-pencil/test-support/assert'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())
const { edgeRow } = pixelProbes(renderer)

function square(graph: SceneGraph, frameId: string, props: Partial<SceneNode>) {
  graph.createNode('RECTANGLE', frameId, { x: 100, y: 100, width: 200, height: 200, ...props })
}

/** Red across a black-to-white edge at x = 100 under a layer of background blur. */
function backgroundBlurRow(radius: number): number[] {
  return edgeRow((graph, frameId) => {
    graph.createNode('RECTANGLE', frameId, { width: 100, height: 400, fills: [solid(0, 0, 0)] })
    graph.createNode('RECTANGLE', frameId, {
      x: 100,
      width: 300,
      height: 400,
      fills: [solid(1, 1, 1)]
    })
    graph.createNode('RECTANGLE', frameId, {
      width: 400,
      height: 400,
      fills: [solid(1, 1, 1, 0.01)],
      effects: [effect('BACKGROUND_BLUR', radius)]
    })
  }, 0)
}

describe('blur effects fall off as in Figma', () => {
  for (const radius of [4, 16]) {
    test(`layer blur, radius ${radius}`, () => {
      const row = edgeRow(
        (graph, frameId) =>
          square(graph, frameId, {
            fills: [solid(1, 0, 0)],
            effects: [effect('LAYER_BLUR', radius)]
          }),
        3
      )
      expectFigmaEdge(row, FIGMA[`LAYER_BLUR ${radius}`])
    })
  }

  test('drop shadow', () => {
    const row = edgeRow(
      (graph, frameId) =>
        square(graph, frameId, { fills: [solid(1, 1, 1)], effects: [effect('DROP_SHADOW', 16)] }),
      3
    )
    expectFigmaEdge(row, FIGMA['DROP_SHADOW 16'])
  })

  test('inner shadow', () => {
    const row = edgeRow(
      (graph, frameId) =>
        square(graph, frameId, { fills: [solid(1, 1, 1)], effects: [effect('INNER_SHADOW', 16)] }),
      0
    )
    // Outside the square nothing is drawn, so the comparison starts at its edge.
    expectFigmaEdge(row, FIGMA['INNER_SHADOW 16'], 100)
  })

  test('background blur', () => {
    expectFigmaEdge(backgroundBlurRow(16), FIGMA['BACKGROUND_BLUR 16'])
  })

  test('background blur on a boolean, inside its result alone', () => {
    // The row crosses the lower circle from x 103; before it the backdrop stays sharp.
    const row = edgeRow((graph, frameId) => {
      graph.createNode('RECTANGLE', frameId, { width: 100, height: 400, fills: [solid(0, 0, 0)] })
      graph.createNode('RECTANGLE', frameId, {
        x: 100,
        width: 300,
        height: 400,
        fills: [solid(1, 1, 1)]
      })
      const union = graph.createNode('BOOLEAN_OPERATION', frameId, {
        x: 40,
        y: 40,
        width: 180,
        height: 240,
        booleanOperation: 'UNION',
        fills: [solid(1, 1, 1, 0.01)],
        effects: [effect('BACKGROUND_BLUR', 16)]
      })
      graph.createNode('ELLIPSE', union.id, { width: 120, height: 120 })
      graph.createNode('ELLIPSE', union.id, { x: 60, y: 120, width: 120, height: 120 })
    }, 0)
    expectFigmaEdge(row, FIGMA['BACKGROUND_BLUR 16 union'])
  })
})

describe('a negative blur, which only a bound variable gives', () => {
  // Figma 126 exports each effect at radius -6 pixel for pixel as at radius 0.
  for (const type of ['DROP_SHADOW', 'INNER_SHADOW', 'LAYER_BLUR'] as const) {
    test(`draws a ${type.toLowerCase()} as no blur`, () => {
      // An inner shadow moved right darkens the white fill at the left edge the row crosses.
      const inner = type === 'INNER_SHADOW'
      const row = (radius: number) =>
        edgeRow(
          (graph, frameId) =>
            square(graph, frameId, {
              fills: [solid(1, 1, 1)],
              effects: [{ ...effect(type, radius), offset: { x: inner ? 10 : -10, y: 0 } }]
            }),
          inner ? 0 : 3
        )
      expect(row(-6)).toEqual(row(0))
    })
  }

  for (const type of ['DROP_SHADOW', 'INNER_SHADOW'] as const) {
    test(`draws a ${type.toLowerCase()} cast from a boolean's silhouette as no blur`, () => {
      const inner = type === 'INNER_SHADOW'
      const row = (radius: number) =>
        edgeRow(
          (graph, frameId) => {
            const union = graph.createNode('BOOLEAN_OPERATION', frameId, {
              x: 100,
              y: 100,
              width: 200,
              height: 200,
              booleanOperation: 'UNION',
              fills: [solid(1, 1, 1)],
              effects: [{ ...effect(type, radius), offset: { x: inner ? 10 : -10, y: 0 } }]
            })
            graph.createNode('RECTANGLE', union.id, { width: 200, height: 120 })
            graph.createNode('RECTANGLE', union.id, { y: 80, width: 200, height: 120 })
          },
          inner ? 0 : 3
        )
      expect(row(-6)).toEqual(row(0))
    })
  }

  test('draws a background blur as no blur', () => {
    expect(backgroundBlurRow(-6)).toEqual(backgroundBlurRow(0))
  })
})

describe('shadows of a transparent fill', () => {
  const shadowRow = (opacity: number, showShadowBehindNode = false) =>
    edgeRow(
      (graph, frameId) =>
        square(graph, frameId, {
          fills: [solid(1, 1, 1, opacity)],
          effects: [{ ...effect('DROP_SHADOW', 16), showShadowBehindNode }]
        }),
      3
    )

  test('a fill at 0% opacity casts no shadow', () => {
    expect(maxOf(shadowRow(0))).toBe(0)
  })

  test('a fill at 1% opacity casts a full one', () => {
    expect(shadowRow(0.01).slice(0, 40)).toEqual(shadowRow(1).slice(0, 40))
  })

  test('a fill at 0% opacity casts none when the shadow shows behind the node', () => {
    expect(maxOf(shadowRow(0, true))).toBe(0)
  })

  test('a fill at 0% opacity takes no inner shadow', () => {
    const row = edgeRow(
      (graph, frameId) =>
        square(graph, frameId, {
          fills: [solid(1, 1, 1, 0)],
          effects: [effect('INNER_SHADOW', 16)]
        }),
      3
    )
    expect(maxOf(row)).toBe(0)
  })

  test('a frame with a fill at 0% opacity casts only its child shadow', () => {
    const row = edgeRow((graph, frameId) => {
      const frame = graph.createNode('FRAME', frameId, {
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        fills: [solid(1, 1, 1, 0)],
        clipsContent: false,
        effects: [effect('DROP_SHADOW', 16)]
      })
      graph.createNode('RECTANGLE', frame.id, {
        x: 40,
        y: 40,
        width: 120,
        height: 120,
        fills: [solid(0, 0, 1)]
      })
    }, 3)
    expect(maxOf(row.slice(0, 41))).toBe(0)
    expect(row[79]).toBeGreaterThan(0)
  })
})
