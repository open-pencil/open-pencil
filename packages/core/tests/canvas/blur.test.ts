import { afterAll, describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit, renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import {
  SceneGraph,
  type Effect,
  type SceneNode,
  type VectorNetwork
} from '@open-pencil/scene-graph'
import { drawnBlurRadius } from '@open-pencil/scene-graph/geometry'

import { expectDefined } from '@open-pencil/test-support/assert'
const ck = await initCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

/**
 * A row of pixels across the left edge of a 200px square at x = 100, from x = 60 to 140, in a
 * 400px frame, read from Figma 126 exports: alpha for layer blur and drop shadow, red for inner
 * shadow on white and for background blur over a black-to-white edge.
 */
const FIGMA: Record<string, number[]> = {
  'LAYER_BLUR 4': [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 3, 19, 51, 99, 157, 204, 237, 252, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255
  ],
  'LAYER_BLUR 16': [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 4, 6, 10, 15, 21,
    28, 36, 46, 55, 66, 77, 91, 105, 120, 135, 150, 164, 177, 188, 200, 210, 219, 227, 234, 240,
    245, 249, 252, 254, 254, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255
  ],
  'DROP_SHADOW 16': [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 4, 6, 10, 15, 21,
    28, 36, 46, 55, 66, 77, 91, 105, 120, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255
  ],
  'INNER_SHADOW 16': [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 135, 151, 164, 178, 190, 201, 211, 220, 227, 235, 239, 245, 249, 252,
    254, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255
  ],
  'BACKGROUND_BLUR 16': [
    3, 4, 4, 4, 3, 4, 3, 4, 4, 3, 3, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 3, 4, 3, 4, 7, 9, 12, 18, 23,
    31, 39, 48, 58, 69, 80, 94, 107, 122, 137, 152, 166, 179, 190, 202, 210, 219, 227, 234, 241,
    245, 249, 252, 254, 254, 255, 255, 254, 255, 255, 255, 254, 255, 254, 254, 254, 255, 255, 255,
    254, 255, 255, 255, 255, 255, 255, 255, 254, 254, 255
  ],
  'BACKGROUND_BLUR 16 union': [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 198, 190, 202, 210, 219, 227, 234, 241, 245, 249, 252,
    254, 254, 255, 255, 254, 255, 255, 255, 254, 255, 254, 254, 254, 255, 255, 255, 254, 255, 255,
    255, 255, 255, 255, 255, 254, 254, 255
  ]
}

const solid = (r: number, g: number, b: number, opacity = 1) => ({
  type: 'SOLID' as const,
  color: { r, g, b, a: 1 },
  opacity,
  visible: true
})

function effect(type: Effect['type'], radius: number): Effect {
  return {
    type,
    radius,
    spread: 0,
    offset: { x: 0, y: 0 },
    color: { r: 0, g: 0, b: 0, a: 1 },
    visible: true,
    blendMode: 'NORMAL',
    showShadowBehindNode: false
  }
}

function edgeRow(build: (graph: SceneGraph, frameId: string) => void, channel: 0 | 3): number[] {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const frame = graph.createNode('FRAME', page, {
    width: 400,
    height: 400,
    fills: [],
    clipsContent: false
  })
  build(graph, frame.id)
  const png = expectDefined(
    renderNodesToImage(ck, renderer, graph, page, [frame.id], {
      scale: 1,
      format: 'PNG',
      trimTransparent: false
    })
  )
  const image = expectDefined(ck.MakeImageFromEncoded(png))
  try {
    const offset = (image.width() - 400) / 2
    const pixels = expectDefined(
      image.readPixels(0, 0, {
        width: image.width(),
        height: image.height(),
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB
      })
    )
    const row: number[] = []
    for (let x = 60; x <= 140; x++) {
      row.push(pixels[((200 + offset) * image.width() + x + offset) * 4 + channel])
    }
    return row
  } finally {
    image.delete()
  }
}

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

function expectFigmaEdge(row: number[], figma: number[], from = 60) {
  const differences = row.flatMap((value, index) =>
    60 + index < from ? [] : [Math.abs(value - figma[index])]
  )
  const rms = Math.sqrt(differences.reduce((sum, d) => sum + d * d, 0) / differences.length)
  expect(Math.max(...differences)).toBeLessThanOrEqual(6)
  expect(rms).toBeLessThanOrEqual(2)
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
        edgeRow((graph, frameId) => {
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
        }, inner ? 0 : 3)
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
    expect(Math.max(...shadowRow(0))).toBe(0)
  })

  test('a fill at 1% opacity casts a full one', () => {
    expect(shadowRow(0.01).slice(0, 40)).toEqual(shadowRow(1).slice(0, 40))
  })

  test('a fill at 0% opacity casts none when the shadow shows behind the node', () => {
    expect(Math.max(...shadowRow(0, true))).toBe(0)
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
    expect(Math.max(...row)).toBe(0)
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
    expect(Math.max(...row.slice(0, 41))).toBe(0)
    expect(row[79]).toBeGreaterThan(0)
  })
})

describe('a layer blur on a glowing dot', () => {
  const glow: Effect = {
    ...effect('DROP_SHADOW', 8),
    spread: 8,
    color: { r: 1, g: 0.1, b: 0, a: 1 },
    showShadowBehindNode: true
  }
  const dotRight = 53
  const oldLayerRight = dotRight + 2 * drawnBlurRadius(1)
  const margin = 3
  const rowStart = 50

  /** Alpha from `rowStart` rightward, on the row through the centre of a 6px dot in an instance. */
  function glowRow(effects: Effect[]): number[] {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const component = graph.createNode('COMPONENT', page, {
      x: 300,
      width: 16,
      height: 16,
      fills: [],
      clipsContent: false
    })
    graph.createNode('ELLIPSE', component.id, {
      x: 5,
      y: 5,
      width: 6,
      height: 6,
      fills: [solid(1, 0.8, 0.6)],
      effects
    })
    const frame = graph.createNode('FRAME', page, {
      width: 100,
      height: 100,
      fills: [],
      clipsContent: false
    })
    expectDefined(graph.createInstance(component.id, frame.id, { x: 42, y: 42 }))
    const png = expectDefined(
      renderNodesToImage(ck, renderer, graph, page, [frame.id], {
        scale: 1,
        format: 'PNG',
        trimTransparent: false
      })
    )
    const image = expectDefined(ck.MakeImageFromEncoded(png))
    try {
      const offset = (image.width() - 100) / 2
      const pixels = expectDefined(
        image.readPixels(0, 0, {
          width: image.width(),
          height: image.height(),
          alphaType: ck.AlphaType.Unpremul,
          colorType: ck.ColorType.RGBA_8888,
          colorSpace: ck.ColorSpace.SRGB
        })
      )
      const row: number[] = []
      for (let x = rowStart; x <= 76; x++) {
        row.push(pixels[((50 + offset) * image.width() + x + offset) * 4 + 3])
      }
      return row
    } finally {
      image.delete()
    }
  }

  test('blurs its halo beyond the dot instead of cutting it at the dot box', () => {
    const halo = glowRow([glow])
    const blurred = glowRow([glow, effect('FOREGROUND_BLUR', 1)])
    const firstPastOldLayer = oldLayerRight + margin - rowStart
    const pastOldLayer = blurred.slice(firstPastOldLayer, firstPastOldLayer + 4)
    expect(Math.min(...pastOldLayer)).toBeGreaterThan(90)
    for (const [i, alpha] of blurred.entries()) {
      expect(Math.abs(alpha - halo[i])).toBeLessThanOrEqual(4)
    }
  })
})

/** How many pixels of a 400px frame `build` fills draw anything into. */
function inkArea(build: (graph: SceneGraph, frameId: string) => void): number {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const frame = graph.createNode('FRAME', page, {
    width: 400,
    height: 400,
    fills: [],
    clipsContent: false
  })
  build(graph, frame.id)
  const png = expectDefined(
    renderNodesToImage(ck, renderer, graph, page, [frame.id], {
      scale: 1,
      format: 'PNG',
      trimTransparent: false
    })
  )
  const image = expectDefined(ck.MakeImageFromEncoded(png))
  try {
    const pixels = expectDefined(
      image.readPixels(0, 0, {
        width: image.width(),
        height: image.height(),
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB
      })
    )
    let area = 0
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 127) {
        area++
      }
    }
    return area
  } finally {
    image.delete()
  }
}

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

describe('a frame casting its drop shadow from a child past its box', () => {
  const childRight = 100 + 60 + 100

  /** Alpha just past the child's right edge, on a row through its middle. */
  function shadowRow(props: Partial<SceneNode>): number[] {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', page, {
      width: 400,
      height: 400,
      fills: [],
      clipsContent: false
    })
    const parent = graph.createNode('FRAME', frame.id, {
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
    const png = expectDefined(
      renderNodesToImage(ck, renderer, graph, page, [frame.id], {
        scale: 1,
        format: 'PNG',
        trimTransparent: false
      })
    )
    const image = expectDefined(ck.MakeImageFromEncoded(png))
    try {
      const pixels = expectDefined(
        image.readPixels(0, 0, {
          width: image.width(),
          height: image.height(),
          alphaType: ck.AlphaType.Unpremul,
          colorType: ck.ColorType.RGBA_8888,
          colorSpace: ck.ColorSpace.SRGB
        })
      )
      const offset = (image.width() - 400) / 2
      const row: number[] = []
      for (let x = childRight + 2; x <= childRight + 10; x++) {
        row.push(pixels[((120 + offset) * image.width() + x + offset) * 4 + 3])
      }
      return row
    } finally {
      image.delete()
    }
  }

  const shadow = effect('DROP_SHADOW', 20)
  const unlayered = shadowRow({ effects: [shadow] })

  test('casts a visible shadow past the child without a layer', () => {
    expect(Math.min(...unlayered)).toBeGreaterThan(25)
  })

  test('keeps the shadow past the child at 0.6 opacity', () => {
    for (const [i, alpha] of shadowRow({ opacity: 0.6, effects: [shadow] }).entries()) {
      expect(Math.abs(alpha - unlayered[i] * 0.6)).toBeLessThanOrEqual(3)
    }
  })

  test('keeps the shadow past the child under a layer blur', () => {
    for (const [i, alpha] of shadowRow({
      effects: [shadow, effect('LAYER_BLUR', 1)]
    }).entries()) {
      expect(Math.abs(alpha - unlayered[i])).toBeLessThanOrEqual(6)
    }
  })
})

describe('a mask whose drawing reaches past its box', () => {
  const barArea = 100 * 20
  const spreadShadow: Effect = { ...effect('DROP_SHADOW', 0), spread: 10 }
  const shadowedBarArea = (100 + 2 * 10) * (20 + 2 * 10)

  /**
   * Red under `mask`, from a sibling whose own box is a 10px square at `maskedX` and whose child
   * covers the whole frame, so only the mask's bounds can hold the masked-in area.
   */
  function maskedArea(
    addMask: (graph: SceneGraph, frameId: string) => void,
    maskedX = 0
  ): number {
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

describe('a layer blur bounded to the viewport', () => {
  /** Ink of a turned frame whose child lies along a 60px viewport strip once turned. */
  function directInk(boundToViewport: boolean): number {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const parent = graph.createNode('FRAME', page, {
      x: 200,
      y: 10,
      width: 40,
      height: 40,
      rotation: 90,
      fills: [],
      clipsContent: false,
      effects: [effect('LAYER_BLUR', 1)]
    })
    graph.createNode('RECTANGLE', parent.id, {
      y: 60,
      width: 40,
      height: 100,
      fills: [solid(0, 0, 1)]
    })
    const surface = expectDefined(ck.MakeSurface(400, 400))
    const previous = {
      bound: renderer.boundEffectLayersToViewport,
      viewport: renderer.worldViewport
    }
    renderer.boundEffectLayersToViewport = boundToViewport
    renderer.worldViewport = { x: 0, y: 0, w: 400, h: 60 }
    try {
      const canvas = surface.getCanvas()
      canvas.clear(ck.TRANSPARENT)
      renderer.renderNode(canvas, graph, parent.id, {})
      surface.flush()
      const pixels = expectDefined(
        canvas.readPixels(0, 0, {
          width: 400,
          height: 400,
          alphaType: ck.AlphaType.Unpremul,
          colorType: ck.ColorType.RGBA_8888,
          colorSpace: ck.ColorSpace.SRGB
        })
      )
      let area = 0
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] > 127) {
          area++
        }
      }
      return area
    } finally {
      renderer.boundEffectLayersToViewport = previous.bound
      renderer.worldViewport = previous.viewport
      surface.delete()
    }
  }

  test('keeps a turned node with a child past its box', () => {
    const unbounded = directInk(false)
    expect(unbounded).toBeGreaterThan(40 * 100 * 0.9)
    expect(Math.abs(directInk(true) - unbounded)).toBeLessThanOrEqual(unbounded * 0.05)
  })
})

describe('drop shadows bounded where their ink fades', () => {
  const CANVAS = 800

  function glowingFrames(graph: SceneGraph, page: string): string[] {
    const ids: string[] = []
    for (const [index, rotation] of [0, 30].entries()) {
      for (const [row, opacity] of [1, 0.6].entries()) {
        const parent = graph.createNode('FRAME', page, {
          x: 40 + index * 200,
          y: 40 + row * 200,
          width: 40,
          height: 40,
          rotation,
          opacity,
          fills: [solid(1, 0.8, 0.6)],
          clipsContent: false,
          effects: [{ ...effect('DROP_SHADOW', 20), spread: 4 }, effect('LAYER_BLUR', 2)]
        })
        graph.createNode('RECTANGLE', parent.id, {
          x: 50,
          width: 40,
          height: 20,
          fills: [solid(0, 0, 1)],
          effects: [effect('DROP_SHADOW', 12)]
        })
        ids.push(parent.id)
      }
    }
    return ids
  }

  function shadowedSquare(radius: number, alpha: number) {
    return (graph: SceneGraph, page: string): string[] => {
      const square = graph.createNode('RECTANGLE', page, {
        x: 300,
        y: 300,
        width: 200,
        height: 200,
        opacity: 0.99,
        fills: [solid(0, 0, 0)],
        effects: [{ ...effect('DROP_SHADOW', radius), color: { r: 1, g: 1, b: 1, a: alpha } }]
      })
      return [square.id]
    }
  }

  /** A closed rectangle as a saved path, the form a vector's fill geometry takes. */
  function rectanglePathBlob(x: number, y: number, width: number, height: number): Uint8Array {
    const corners = [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height]
    ]
    const blob = new Uint8Array(corners.length * 9 + 1)
    const view = new DataView(blob.buffer)
    for (const [index, [cornerX, cornerY]] of corners.entries()) {
      blob[index * 9] = index === 0 ? 1 : 2
      view.setFloat32(index * 9 + 1, cornerX, true)
      view.setFloat32(index * 9 + 5, cornerY, true)
    }
    return blob
  }

  function shadowedPathPastItsBox(graph: SceneGraph, page: string): string[] {
    const vector = graph.createNode('VECTOR', page, {
      x: 200,
      y: 300,
      width: 40,
      height: 40,
      opacity: 0.6,
      fills: [solid(0, 0, 1)],
      fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: rectanglePathBlob(0, 0, 300, 40) }],
      effects: [{ ...effect('DROP_SHADOW', 30), color: { r: 1, g: 0, b: 0, a: 1 } }]
    })
    return [vector.id]
  }

  /** A closed rectangle as a vector network, the form a vector's strokes are drawn from. */
  function rectangleNetwork(width: number, height: number): VectorNetwork {
    const corners = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height }
    ]
    const straight = { tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
    return {
      vertices: corners,
      segments: corners.map((_, index) => ({ start: index, end: (index + 1) % 4, ...straight })),
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]] }]
    }
  }

  function strokedPathPastItsBox(graph: SceneGraph, page: string): string[] {
    const vector = graph.createNode('VECTOR', page, {
      x: 200,
      y: 300,
      width: 40,
      height: 40,
      opacity: 0.6,
      fills: [solid(0, 0, 1)],
      fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: rectanglePathBlob(0, 0, 300, 40) }],
      vectorNetwork: rectangleNetwork(300, 40),
      strokes: [{ ...solid(1, 0, 0), weight: 20, align: 'OUTSIDE' }],
      strokeWeight: 20,
      strokeAlign: 'OUTSIDE'
    })
    return [vector.id]
  }

  /** Every pixel of a scene, its layers bounded or opened over the whole canvas. */
  function scenePixels(
    build: (graph: SceneGraph, page: string) => string[],
    boundLayers: boolean
  ): Float32Array | Uint8Array {
    const graph = new SceneGraph()
    const ids = build(graph, graph.getPages()[0].id)
    const surface = expectDefined(ck.MakeSurface(CANVAS, CANVAS))
    const previousViewport = renderer.worldViewport
    renderer.worldViewport = { x: 0, y: 0, w: CANVAS, h: CANVAS }
    try {
      const canvas = surface.getCanvas()
      if (!boundLayers) {
        const saveLayer = canvas.saveLayer.bind(canvas)
        canvas.saveLayer = (paint, _bounds, ...rest) => saveLayer(paint, null, ...rest)
      }
      canvas.clear(ck.TRANSPARENT)
      for (const id of ids) {
        renderer.renderNode(canvas, graph, id, {})
      }
      surface.flush()
      return expectDefined(
        canvas.readPixels(0, 0, {
          width: CANVAS,
          height: CANVAS,
          alphaType: ck.AlphaType.Premul,
          colorType: ck.ColorType.RGBA_8888,
          colorSpace: ck.ColorSpace.SRGB
        })
      )
    } finally {
      renderer.worldViewport = previousViewport
      surface.delete()
    }
  }

  test.each([
    ['glowing frames under a layer blur', glowingFrames],
    ['an opaque white 60px shadow at 0.99 opacity', shadowedSquare(60, 1)],
    ["Figma's default 25% shadow at 60px and 0.99 opacity", shadowedSquare(60, 0.25)],
    ['a 10% shadow at 60px and 0.99 opacity', shadowedSquare(60, 0.1)],
    ['a 49% shadow at 60px and 0.99 opacity', shadowedSquare(60, 0.49)],
    ['a 50% shadow at 60px and 0.99 opacity', shadowedSquare(60, 0.5)],
    ['a vector path past its box with a drop shadow, at 0.6 opacity', shadowedPathPastItsBox],
    ['a vector path past its box with an outside stroke, at 0.6 opacity', strokedPathPastItsBox]
  ])('draws %s as layers with no bounds do, on CPU raster', (_, build) => {
    const bounded = scenePixels(build, true)
    const unbounded = scenePixels(build, false)
    let differing = 0
    for (let index = 0; index < bounded.length; index++) {
      if (bounded[index] !== unbounded[index]) {
        differing++
      }
    }
    expect(unbounded.some((value) => value > 0)).toBe(true)
    expect(differing).toBe(0)
  })
})

describe('layer bounds after the graph changes', () => {
  const CANVAS = 400

  /** Pixels a blurred frame's subtree inks at more than half alpha. */
  function inkedPixels(
    graph: SceneGraph,
    frameId: string,
    overlays: Parameters<SkiaRenderer['renderNode']>[3] = {}
  ): number {
    const surface = expectDefined(ck.MakeSurface(CANVAS, CANVAS))
    const previousViewport = renderer.worldViewport
    renderer.worldViewport = { x: 0, y: 0, w: CANVAS, h: CANVAS }
    try {
      const canvas = surface.getCanvas()
      canvas.clear(ck.TRANSPARENT)
      renderer.renderNode(canvas, graph, frameId, overlays)
      surface.flush()
      const pixels = expectDefined(
        canvas.readPixels(0, 0, {
          width: CANVAS,
          height: CANVAS,
          alphaType: ck.AlphaType.Unpremul,
          colorType: ck.ColorType.RGBA_8888,
          colorSpace: ck.ColorSpace.SRGB
        })
      )
      let inked = 0
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] > 128) {
          inked++
        }
      }
      return inked
    } finally {
      renderer.worldViewport = previousViewport
      surface.delete()
    }
  }

  test('follow a child moved, resized, previewed, turned, and given a child', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', page, {
      x: 50,
      y: 50,
      width: 20,
      height: 20,
      fills: [],
      clipsContent: false,
      effects: [effect('LAYER_BLUR', 1)]
    })
    const child = graph.createNode('RECTANGLE', frame.id, {
      width: 20,
      height: 20,
      fills: [solid(0, 0, 1)]
    })
    const square = inkedPixels(graph, frame.id)
    expect(square).toBeGreaterThan(0)

    graph.updateNode(child.id, { x: 100 })
    expect(inkedPixels(graph, frame.id)).toBeGreaterThan(square * 0.9)

    graph.updateNode(child.id, { width: 100 })
    const bar = inkedPixels(graph, frame.id)
    expect(bar).toBeGreaterThan(square * 4)

    graph.updateNodePreview(child.id, { x: 200 })
    expect(inkedPixels(graph, frame.id)).toBeGreaterThan(bar * 0.9)

    const turned = (angle: number) =>
      inkedPixels(graph, frame.id, { rotationPreview: { nodeId: child.id, angle } })
    expect(turned(90)).toBeGreaterThan(bar * 0.9)
    expect(turned(90)).toBeGreaterThan(bar * 0.9)
    expect(turned(45)).toBeGreaterThan(bar * 0.9)

    graph.createNode('RECTANGLE', child.id, { width: 0, height: 0, fills: [solid(0, 0, 1)] })
    graph.updateNode(child.id, { x: -40 })
    expect(inkedPixels(graph, frame.id)).toBeGreaterThan(bar * 0.9)
  })
})

describe('a node picture drawn into a tile that shows only its shadow', () => {
  const CANVAS = 300
  const boxRight = 100 + 100
  const tileLeft = boxRight + 22

  /** Alpha summed over the strip from `tileLeft` rightward, the tile clipped there or not. */
  function shadowInk(clipToTile: boolean): number {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const square = graph.createNode('RECTANGLE', page, {
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      fills: [solid(0, 0, 0)],
      effects: [{ ...effect('DROP_SHADOW', 20), color: { r: 0, g: 0, b: 0, a: 1 } }]
    })
    renderer.nodePictures.delete(square.id)
    const surface = expectDefined(ck.MakeSurface(CANVAS, CANVAS))
    const previousViewport = renderer.worldViewport
    renderer.worldViewport = { x: 0, y: 0, w: CANVAS, h: CANVAS }
    try {
      const canvas = surface.getCanvas()
      canvas.clear(ck.TRANSPARENT)
      canvas.save()
      if (clipToTile) {
        canvas.clipRect(ck.LTRBRect(tileLeft, 0, CANVAS, CANVAS), ck.ClipOp.Intersect, false)
      }
      renderer.renderNode(canvas, graph, square.id, {})
      canvas.restore()
      surface.flush()
      const pixels = expectDefined(
        canvas.readPixels(0, 0, {
          width: CANVAS,
          height: CANVAS,
          alphaType: ck.AlphaType.Unpremul,
          colorType: ck.ColorType.RGBA_8888,
          colorSpace: ck.ColorSpace.SRGB
        })
      )
      let ink = 0
      for (let y = 0; y < CANVAS; y++) {
        for (let x = tileLeft; x < CANVAS; x++) {
          ink += pixels[(y * CANVAS + x) * 4 + 3]
        }
      }
      renderer.nodePictures.delete(square.id)
      return ink
    } finally {
      renderer.worldViewport = previousViewport
      surface.delete()
    }
  }

  test('draws the same shadow there as a canvas that shows all of it', () => {
    const whole = shadowInk(false)
    expect(whole).toBeGreaterThan(0)
    expect(shadowInk(true)).toBe(whole)
  })
})
