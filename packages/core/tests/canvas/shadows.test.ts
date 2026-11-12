import { afterAll, describe, expect, test } from 'bun:test'

import { FIGMA_SHADOW_ROWS as FIGMA } from '#core-tests/canvas/shadows/figma'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph, type Effect, type SceneNode } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { separateShadowChildren } from '#core/canvas/shadows/silhouette'

import { expectFigmaRow, renderRow, type FigmaRowScene } from '../helpers/figma-rows'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

const solid = (r: number, g: number, b: number, opacity = 1) => ({
  type: 'SOLID' as const,
  color: { r, g, b, a: 1 },
  opacity,
  visible: true
})
const RED = solid(1, 0, 0)
const BLUE = solid(0, 0, 1)
const GREEN = solid(0, 0.6, 0)

function shadow(type: Effect['type'], props: Partial<Effect> = {}): Effect {
  const offset = type === 'INNER_SHADOW' ? 8 : 12
  return {
    type,
    radius: 8,
    spread: 0,
    offset: { x: offset, y: offset },
    color: { r: 0, g: 0, b: 0, a: 1 },
    visible: true,
    blendMode: 'NORMAL',
    showShadowBehindNode: false,
    ...props
  }
}

/** A 160px square at (120, 70), where every scene puts its shadowed layer. */
const square = { x: 120, y: 70, width: 160, height: 160 }

function centerStroke(opacity = 1): Pick<SceneNode, 'strokes' | 'strokeWeight' | 'strokeAlign'> {
  return {
    strokes: [{ ...solid(0, 0, 1, opacity), weight: 8, align: 'CENTER' }],
    strokeWeight: 8,
    strokeAlign: 'CENTER'
  }
}

function twoChildren(graph: SceneGraph, parentId: string): void {
  graph.createNode('RECTANGLE', parentId, { x: 10, y: 10, width: 60, height: 60, fills: [BLUE] })
  graph.createNode('RECTANGLE', parentId, { x: 90, y: 90, width: 60, height: 60, fills: [GREEN] })
}

function overflowingChild(graph: SceneGraph, parentId: string): void {
  graph.createNode('RECTANGLE', parentId, { x: -60, y: 50, width: 120, height: 50, fills: [BLUE] })
}

const row = (build: FigmaRowScene, y: number, x0: number, x1: number, channel = 3) =>
  renderRow(ck, renderer, build, y, x0, x1, channel)

describe('drop shadows are cast from what the layer draws, as in Figma', () => {
  test('a shape without a fill casts from its stroke and hides the shadow inside', () => {
    for (const showShadowBehindNode of [false, true]) {
      const values = row(
        (graph, hostId) =>
          graph.createNode('RECTANGLE', hostId, {
            ...square,
            fills: [],
            ...centerStroke(),
            effects: [shadow('DROP_SHADOW', { showShadowBehindNode })]
          }),
        150,
        104,
        306
      )
      expectFigmaRow(values, FIGMA[`rect-nofill-stroke-CENTER-${showShadowBehindNode ? 'T' : 'F'}`])
    }
  })

  test('a translucent fill hides the shadow under it unless it shows behind the node', () => {
    for (const showShadowBehindNode of [false, true]) {
      const values = row(
        (graph, hostId) =>
          graph.createNode('RECTANGLE', hostId, {
            ...square,
            fills: [solid(1, 0, 0, 0.5)],
            effects: [shadow('DROP_SHADOW', { showShadowBehindNode })]
          }),
        150,
        104,
        306
      )
      expectFigmaRow(values, FIGMA[`rect-fill50-${showShadowBehindNode ? 'T' : 'F'}`])
    }
  })

  test('a frame without a fill casts from every child', () => {
    const values = row(
      (graph, hostId) => {
        const frame = graph.createNode('FRAME', hostId, {
          ...square,
          fills: [],
          clipsContent: false,
          effects: [shadow('DROP_SHADOW')]
        })
        twoChildren(graph, frame.id)
      },
      200,
      196,
      300
    )
    expectFigmaRow(values, FIGMA['frame-nofill-two-F'])
  })

  test('children outside a frame cast unless the frame clips them', () => {
    for (const clipsContent of [false, true]) {
      const values = row(
        (graph, hostId) => {
          const frame = graph.createNode('FRAME', hostId, {
            ...square,
            fills: [RED],
            clipsContent,
            effects: [shadow('DROP_SHADOW')]
          })
          overflowingChild(graph, frame.id)
        },
        175,
        50,
        130
      )
      expectFigmaRow(values, FIGMA[`frame-fill1-overflow-${clipsContent ? 'clip' : 'noclip'}`])
    }
  })

  test('a shape at 0% fill in a group hides the shadow of what it covers', () => {
    for (const showShadowBehindNode of [false, true]) {
      const values = row(
        (graph, hostId) => {
          const group = graph.createNode('GROUP', hostId, {
            ...square,
            effects: [shadow('DROP_SHADOW', { showShadowBehindNode })]
          })
          graph.createNode('RECTANGLE', group.id, {
            x: 0,
            y: 0,
            width: 160,
            height: 160,
            fills: [solid(1, 0, 0, 0)]
          })
          graph.createNode('RECTANGLE', group.id, {
            x: 40,
            y: 40,
            width: 80,
            height: 80,
            fills: [BLUE]
          })
        },
        200,
        150,
        260
      )
      expectFigmaRow(values, FIGMA[`group-fill0rect-child-${showShadowBehindNode ? 'T' : 'F'}`])
    }
  })

  test('a clipping frame hides its children shadows inside it unless they show behind', () => {
    for (const showShadowBehindNode of [false, true]) {
      const values = row(
        (graph, hostId) => {
          const frame = graph.createNode('FRAME', hostId, {
            ...square,
            fills: [],
            clipsContent: true,
            effects: [shadow('DROP_SHADOW', { showShadowBehindNode })]
          })
          twoChildren(graph, frame.id)
        },
        200,
        200,
        300
      )
      expectFigmaRow(
        values,
        FIGMA[showShadowBehindNode ? 'frame-clip-nofill-two-T' : 's0-frame-nofill-two-clip']
      )
    }
  })

  test('spread applies to a frame only when it clips its content', () => {
    for (const clipsContent of [false, true]) {
      const values = row(
        (graph, hostId) =>
          graph.createNode('FRAME', hostId, {
            ...square,
            fills: [RED],
            clipsContent,
            effects: [shadow('DROP_SHADOW', { spread: 10 })]
          }),
        150,
        270,
        310
      )
      expectFigmaRow(values, FIGMA[`s10-frame-fill1-${clipsContent ? 'clip' : 'noclip'}`])
    }
  })

  test('a boolean operation casts from its result', () => {
    const values = row(
      (graph, hostId) => {
        const union = graph.createNode('BOOLEAN_OPERATION', hostId, {
          x: 130,
          y: 80,
          width: 110,
          height: 130,
          booleanOperation: 'UNION',
          fills: [RED],
          effects: [shadow('DROP_SHADOW')]
        })
        graph.createNode('RECTANGLE', union.id, {
          x: 0,
          y: 0,
          width: 100,
          height: 60,
          fills: [BLUE]
        })
        graph.createNode('RECTANGLE', union.id, {
          x: 50,
          y: 30,
          width: 60,
          height: 100,
          fills: [BLUE]
        })
      },
      180,
      226,
      270
    )
    expectFigmaRow(values, FIGMA['n-union'])
  })
})

describe('arcs cast from the arc, not the whole ellipse', () => {
  test('a half pie casts only below its flat edge', () => {
    const pie: FigmaRowScene = (graph, hostId) =>
      graph.createNode('ELLIPSE', hostId, {
        ...square,
        fills: [RED],
        arcData: { startingAngle: 0, endingAngle: Math.PI, innerRadius: 0 },
        effects: [shadow('DROP_SHADOW')]
      })
    // Outside the ellipse, right of it: under the missing top half, then beside the pie.
    const above = row(pie, square.y + 60, square.x + 162, square.x + 168)
    const beside = row(pie, square.y + 100, square.x + 162, square.x + 168)
    expect(Math.max(...above)).toBeLessThanOrEqual(2)
    expect(Math.min(...beside)).toBeGreaterThan(200)
  })
})

// Figma 126 grows or shrinks the shadow of a box or an ellipse by its spread, and ignores the spread
// of a star, polygon, or vector, drop or inner: their exports match the same shadow without one.
describe('only boxes and ellipses take a spread, as in Figma', () => {
  const sharp = { radius: 0, spread: 6 }

  test('a rounded rectangle shrinks the hole of its inner shadow by the spread (red channel)', () => {
    const values = row(
      (graph, hostId) =>
        graph.createNode('RECTANGLE', hostId, {
          ...square,
          fills: [RED],
          cornerRadius: 40,
          effects: [shadow('INNER_SHADOW', sharp)]
        }),
      100,
      130,
      270,
      0
    )
    expectFigmaRow(values, FIGMA['rounded-inner-spread'])
  })

  test('a star casts its drop shadow without the spread', () => {
    const values = row(
      (graph, hostId) =>
        graph.createNode('STAR', hostId, {
          ...square,
          fills: [RED],
          pointCount: 5,
          starInnerRadius: 0.4,
          effects: [shadow('DROP_SHADOW', sharp)]
        }),
      170,
      100,
      330
    )
    expectFigmaRow(values, FIGMA['star-drop-spread'])
  })

  test('a polygon takes its inner shadow without the spread (red channel)', () => {
    const values = row(
      (graph, hostId) =>
        graph.createNode('POLYGON', hostId, {
          ...square,
          fills: [RED],
          pointCount: 3,
          effects: [shadow('INNER_SHADOW', sharp)]
        }),
      160,
      120,
      280,
      0
    )
    expectFigmaRow(values, FIGMA['polygon-inner-spread'])
  })
})

describe('inner shadows sit where Figma draws them', () => {
  test('a shape takes its inner shadow under its strokes (blue channel)', () => {
    const values = row(
      (graph, hostId) =>
        graph.createNode('RECTANGLE', hostId, {
          ...square,
          fills: [RED],
          strokes: [{ ...solid(0, 0, 1, 0.5), weight: 12, align: 'INSIDE' }],
          strokeWeight: 12,
          strokeAlign: 'INSIDE',
          effects: [shadow('INNER_SHADOW')]
        }),
      150,
      114,
      150,
      2
    )
    expectFigmaRow(values, FIGMA['inner-rect-stroke-INSIDE'])
  })

  test('a frame takes its inner shadow over its children (blue channel)', () => {
    const values = row(
      (graph, hostId) => {
        const frame = graph.createNode('FRAME', hostId, {
          ...square,
          fills: [RED],
          clipsContent: true,
          effects: [shadow('INNER_SHADOW')]
        })
        graph.createNode('RECTANGLE', frame.id, {
          x: 0,
          y: 0,
          width: 160,
          height: 50,
          fills: [BLUE]
        })
      },
      95,
      116,
      170,
      2
    )
    expectFigmaRow(values, FIGMA['inner-frame-clip-child-at-edge'])
  })

  test('an offset larger than the blur shades the whole strip it uncovers (red channel)', () => {
    const values = row(
      (graph, hostId) => {
        const union = graph.createNode('BOOLEAN_OPERATION', hostId, {
          ...square,
          booleanOperation: 'UNION',
          fills: [RED],
          effects: [shadow('INNER_SHADOW', { radius: 4, offset: { x: 50, y: 0 } })]
        })
        graph.createNode('RECTANGLE', union.id, {
          x: 0,
          y: 0,
          width: 160,
          height: 160,
          fills: [BLUE]
        })
      },
      40 + square.y,
      square.x,
      square.x + 60,
      0
    )
    // Opaque black covers the first 50px; past the blur the fill shows again.
    expect(Math.max(...values.slice(0, 22))).toBeLessThanOrEqual(2)
    expect(values.at(-1)).toBe(255)
  })
})

describe('a container with one turned child casts from that child alone, as in Figma', () => {
  const turnedChild =
    (effect: Effect, child: Partial<SceneNode>): FigmaRowScene =>
    (graph, hostId) => {
      const frame = graph.createNode('FRAME', hostId, {
        ...square,
        fills: [],
        clipsContent: false,
        effects: [effect]
      })
      graph.createNode('RECTANGLE', frame.id, {
        x: 30,
        y: 50,
        width: 100,
        height: 60,
        fills: [RED],
        ...child
      })
    }

  test('takes the turned child as the source of its shadows', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    turnedChild(shadow('DROP_SHADOW'), { rotation: 30, flipX: true })(graph, page)
    const frame = expectDefined(graph.getNode(expectDefined(graph.getNode(page)).childIds[0]))
    expect(separateShadowChildren(graph, frame, 0)?.map((child) => child.id)).toEqual(
      frame.childIds
    )
  })

  test('offsets the drop shadow in the container’s space, however the child turns', () => {
    const drop = shadow('DROP_SHADOW', { offset: { x: 12, y: 0 } })
    expectFigmaRow(
      row(turnedChild(drop, { rotation: 30 }), 150, 230, 300),
      FIGMA['turned-child-drop']
    )
    expectFigmaRow(
      row(turnedChild(drop, { rotation: 30, flipX: true }), 150, 230, 300),
      FIGMA['flipped-child-drop']
    )
  })

  test('offsets the inner shadow the same way (red channel)', () => {
    const inner = shadow('INNER_SHADOW', { radius: 6, offset: { x: 10, y: 0 } })
    expectFigmaRow(
      row(turnedChild(inner, { rotation: 30 }), 140, 140, 260, 0),
      FIGMA['turned-child-inner']
    )
  })
})

describe('a container casts from each of its separate children on its own, as in Figma', () => {
  const HALF_BLUE = solid(0, 0, 1, 0.5)
  const separateChildren =
    (effect: Effect, fills: SceneNode['fills'], gap = 50): FigmaRowScene =>
    (graph, hostId) => {
      const frame = graph.createNode('FRAME', hostId, {
        x: 20,
        y: 60,
        width: 360,
        height: 160,
        fills: [],
        clipsContent: false,
        effects: [effect]
      })
      const child = { y: 20, height: 60, fills }
      graph.createNode('RECTANGLE', frame.id, { ...child, x: 10, width: 80, cornerRadius: 8 })
      graph.createNode('RECTANGLE', frame.id, { ...child, x: 90 + gap, width: 80 })
      graph.createNode('ELLIPSE', frame.id, { ...child, x: 170 + 2 * gap, width: 60 })
    }
  const drop = shadow('DROP_SHADOW', { offset: { x: 4, y: 8 } })

  test('takes children apart only when their shadows cannot reach each other', () => {
    for (const [gap, separate] of [
      [50, true],
      [10, false]
    ] as const) {
      const graph = new SceneGraph()
      const page = graph.getPages()[0].id
      separateChildren(drop, [RED], gap)(graph, page)
      const frame = expectDefined(graph.getNode(expectDefined(graph.getNode(page)).childIds[0]))
      const children = separateShadowChildren(graph, frame, 30)
      expect(children?.length ?? 0).toBe(separate ? 3 : 0)
    }
  })

  test('casts the drop shadow and hides it under each translucent child', () => {
    const scene = separateChildren(drop, [HALF_BLUE])
    expectFigmaRow(row(scene, 146, 20, 380), FIGMA['separate-children-drop'])
    expectFigmaRow(row(scene, 120, 20, 380), FIGMA['separate-children-knockout'])
  })

  test('puts the inner shadow on each child (red channel)', () => {
    const inner = shadow('INNER_SHADOW', { radius: 6, offset: { x: 6, y: 6 } })
    expectFigmaRow(
      row(separateChildren(inner, [RED]), 90, 20, 290, 0),
      FIGMA['separate-children-inner']
    )
  })
})
