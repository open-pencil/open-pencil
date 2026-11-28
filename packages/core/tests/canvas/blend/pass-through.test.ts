import { afterAll, describe, expect, spyOn, test } from 'bun:test'

import { effect } from '#core-tests/canvas/blur/helpers'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph, type BlendMode, type Fill, type VectorNetwork } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { restoreBlendedLayer, saveLayerOverBackdrop } from '#core/canvas/blend/modes'
import { withNodeLayer } from '#core/canvas/blend/node-layer'

const SIZE = 40
const STRIPE = 4

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(SIZE, SIZE), 'surface'))
afterAll(() => renderer.destroy())

type Scene = (graph: SceneGraph, pageId: string) => void

const nothing: Scene = () => undefined

function grey(value: number, opacity = 1, blendMode: BlendMode = 'NORMAL'): Fill {
  return {
    type: 'SOLID',
    color: { r: value, g: value, b: value, a: 1 },
    opacity,
    visible: true,
    blendMode
  }
}

function greyBackdrop(opacity = 1): Scene {
  return (graph, pageId) => {
    graph.createNode('RECTANGLE', pageId, {
      width: SIZE,
      height: SIZE,
      fills: [grey(0.5, opacity)]
    })
  }
}

function renderScene(build: Scene, under: Scene): void {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  under(graph, page.id)
  build(graph, page.id)
  renderer.pageId = page.id
  const canvas = renderer.surface.getCanvas()
  canvas.clear(ck.TRANSPARENT)
  renderer.renderSceneToCanvas(canvas, graph, page.id)
}

function renderCenter(build: Scene, under: Scene = greyBackdrop()): number[] {
  renderScene(build, under)
  return readCenter()
}

function renderMiddleRowRed(build: Scene, under: Scene): number[] {
  renderScene(build, under)
  const row = readPixels(0, SIZE / 2, SIZE)
  return row.filter((_, index) => index % 4 === 0)
}

function readCenter(): number[] {
  return readPixels(SIZE / 2, SIZE / 2, 1)
}

function readPixels(x: number, y: number, width: number): number[] {
  renderer.surface.flush()
  const image = renderer.surface.makeImageSnapshot()
  try {
    const pixels = expectDefined(
      image.readPixels(x, y, {
        width,
        height: 1,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      }),
      'pixels'
    )
    return Array.from(pixels)
  } finally {
    image.delete()
  }
}

function expectNear(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThan(2)
}

function expectChannelsNear(actual: number[], expected: number[]) {
  expected.forEach((channel, index) => expectNear(actual[index], channel))
}

interface Layer {
  fill: Fill
  blendMode?: BlendMode
}

function passThroughGroup(opacity: number, layers: Layer[]): Scene {
  return (graph, pageId) => {
    const group = graph.createNode('FRAME', pageId, {
      width: SIZE,
      height: SIZE,
      fills: [],
      blendMode: 'PASS_THROUGH',
      opacity
    })
    for (const layer of layers) {
      graph.createNode('RECTANGLE', group.id, {
        width: SIZE,
        height: SIZE,
        fills: [layer.fill],
        blendMode: layer.blendMode ?? 'NORMAL'
      })
    }
  }
}

function renderGroupRed(opacity: number, layers: Layer[], under = greyBackdrop()): number {
  return renderCenter(passThroughGroup(opacity, layers), under)[0]
}

function premultiplied(pixel: number[]): number[] {
  return [...pixel.slice(0, 3).map((channel) => (channel * pixel[3]) / 255), pixel[3]]
}

// Live-measured in Figma: a 50% grey backdrop under a pass-through frame at 50% and 70%.
const PASS_THROUGH_CASES: { name: string; layers: Layer[]; figma: [number, number] }[] = [
  {
    name: 'a multiply layer',
    layers: [{ fill: grey(0.4), blendMode: 'MULTIPLY' }],
    figma: [90, 75]
  },
  { name: 'a screen layer', layers: [{ fill: grey(0.6), blendMode: 'SCREEN' }], figma: [166, 181] },
  {
    name: 'a multiply layer over a half transparent sibling',
    layers: [{ fill: grey(1, 0.5) }, { fill: grey(0.2), blendMode: 'MULTIPLY' }],
    figma: [83, 66]
  },
  {
    name: 'a screen layer over a translucent sibling',
    layers: [{ fill: grey(0.2, 0.6) }, { fill: grey(0.5), blendMode: 'SCREEN' }],
    figma: [149, 157]
  },
  { name: 'a normal layer', layers: [{ fill: grey(0.9) }], figma: [179, 200] }
]

const MULTIPLY_AT_HALF = PASS_THROUGH_CASES[0].figma[0]

describe('a pass-through group with opacity', () => {
  for (const { name, layers, figma } of PASS_THROUGH_CASES) {
    test(`blends ${name} with what is under the group, as Figma does`, () => {
      expectNear(renderGroupRed(0.5, layers), figma[0])
      expectNear(renderGroupRed(0.7, layers), figma[1])
    })
  }

  test('fades a soft light layer from the backdrop toward the opaque group', () => {
    const softLight = [{ fill: grey(0.1), blendMode: 'SOFT_LIGHT' as const }]
    const backdropRed = renderCenter(nothing)[0]
    const opaque = renderGroupRed(1, softLight)
    for (const opacity of [0.5, 0.7]) {
      expectNear(renderGroupRed(opacity, softLight), backdropRed + (opaque - backdropRed) * opacity)
    }
  })

  test('blends a fill blend mode of a layer with what is under the group', () => {
    expectNear(renderGroupRed(0.5, [{ fill: grey(0.4, 1, 'MULTIPLY') }]), MULTIPLY_AT_HALF)
  })

  test('keeps a half transparent backdrop as it is where the group draws nothing', () => {
    const corner: Scene = (graph, pageId) => {
      const group = graph.createNode('FRAME', pageId, {
        width: SIZE,
        height: SIZE,
        fills: [],
        blendMode: 'PASS_THROUGH',
        opacity: 0.5
      })
      graph.createNode('RECTANGLE', group.id, {
        width: 4,
        height: 4,
        fills: [grey(0.4)],
        blendMode: 'MULTIPLY'
      })
    }
    const halfGrey = greyBackdrop(0.5)
    expectChannelsNear(renderCenter(corner, halfGrey), renderCenter(nothing, halfGrey))
  })

  test('leaves the backdrop just outside the layer as it is', () => {
    const canvas = renderer.surface.getCanvas()
    const halfGrey = ck.Color(128, 128, 128, 0.5)
    canvas.clear(halfGrey)
    const beside = ck.LTRBRect(SIZE / 2 + 1, 0, SIZE, SIZE)
    saveLayerOverBackdrop(renderer, canvas, renderer.opacityPaint, 0.5, beside)
    restoreBlendedLayer(canvas)
    expectChannelsNear(readCenter(), [128, 128, 128, 128])
  })

  test('fades a blending layer over a half transparent backdrop as the opaque group fades', () => {
    const multiply = [{ fill: grey(0.4), blendMode: 'MULTIPLY' as const }]
    const halfGrey = greyBackdrop(0.5)
    const before = premultiplied(renderCenter(nothing, halfGrey))
    const opaque = premultiplied(renderCenter(passThroughGroup(1, multiply), halfGrey))
    const expected = before.map((channel, index) => (channel + opaque[index]) / 2)
    const actual = premultiplied(renderCenter(passThroughGroup(0.5, multiply), halfGrey))
    expectChannelsNear(actual, expected)
  })
})

describe('a pass-through layer with opacity whose own paints blend', () => {
  test('blends a child stroke with what is under the group', () => {
    const strokedChild: Scene = (graph, pageId) => {
      const group = graph.createNode('FRAME', pageId, {
        width: SIZE,
        height: SIZE,
        fills: [],
        blendMode: 'PASS_THROUGH',
        opacity: 0.5
      })
      graph.createNode('RECTANGLE', group.id, {
        width: SIZE,
        height: SIZE,
        fills: [],
        strokes: [{ ...grey(0.4, 1, 'MULTIPLY'), weight: SIZE * 2, align: 'CENTER' }],
        strokeWeight: SIZE * 2,
        strokeAlign: 'CENTER'
      })
    }
    expectNear(renderCenter(strokedChild)[0], MULTIPLY_AT_HALF)
  })

  test('blends its own fill with what is under it', () => {
    const multiplyLeaf: Scene = (graph, pageId) => {
      graph.createNode('RECTANGLE', pageId, {
        width: SIZE,
        height: SIZE,
        fills: [grey(0.4, 1, 'MULTIPLY')],
        blendMode: 'PASS_THROUGH',
        opacity: 0.5
      })
    }
    expectNear(renderCenter(multiplyLeaf)[0], MULTIPLY_AT_HALF)
  })

  test('fades by its own opacity after a translucent mask drew earlier in the frame', () => {
    const maskThenGroup: Scene = (graph, pageId) => {
      const masked = graph.createNode('FRAME', pageId, { width: 2, height: 2, fills: [] })
      graph.createNode('RECTANGLE', masked.id, {
        width: 2,
        height: 2,
        fills: [grey(0)],
        isMask: true,
        opacity: 0.5
      })
      graph.createNode('RECTANGLE', masked.id, { width: 2, height: 2, fills: [grey(1)] })
      passThroughGroup(0.5, [{ fill: grey(0.4), blendMode: 'MULTIPLY' }])(graph, pageId)
    }
    expectNear(renderCenter(maskThenGroup)[0], MULTIPLY_AT_HALF)
  })
})

function squareNetwork(regionFills: Fill[]): VectorNetwork {
  const corners = [
    { x: 0, y: 0 },
    { x: SIZE, y: 0 },
    { x: SIZE, y: SIZE },
    { x: 0, y: SIZE }
  ]
  const straight = { tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
  return {
    vertices: corners,
    segments: corners.map((_, index) => ({ start: index, end: (index + 1) % 4, ...straight })),
    regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2, 3]], fills: regionFills }]
  }
}

const stripes: Scene = (graph, pageId) => {
  graph.createNode('RECTANGLE', pageId, { width: SIZE, height: SIZE, fills: [grey(0)] })
  for (let x = 0; x < SIZE; x += STRIPE * 2) {
    graph.createNode('RECTANGLE', pageId, { x, width: STRIPE, height: SIZE, fills: [grey(1)] })
  }
}

function halfPassThroughFrame(graph: SceneGraph, pageId: string): string {
  return graph.createNode('FRAME', pageId, {
    width: SIZE,
    height: SIZE,
    fills: [],
    blendMode: 'PASS_THROUGH',
    opacity: 0.5
  }).id
}

describe('a pass-through group with opacity over what draws with the backdrop', () => {
  test('blends a vector region fill with what is under the group', () => {
    const regionMultiply: Scene = (graph, pageId) => {
      graph.createNode('VECTOR', halfPassThroughFrame(graph, pageId), {
        width: SIZE,
        height: SIZE,
        fills: [grey(0.9)],
        vectorNetwork: squareNetwork([grey(0.4, 1, 'MULTIPLY')])
      })
    }
    expectNear(renderCenter(regionMultiply)[0], MULTIPLY_AT_HALF)
  })

  test('lets a background blur see under the group whether or not a sibling blends', () => {
    const blurred = (withBlendingSibling: boolean): Scene => {
      return (graph, pageId) => {
        const frameId = halfPassThroughFrame(graph, pageId)
        graph.createNode('RECTANGLE', frameId, {
          width: SIZE,
          height: SIZE,
          fills: [grey(1, 0.01)],
          effects: [effect('BACKGROUND_BLUR', 4)]
        })
        if (withBlendingSibling) {
          graph.createNode('RECTANGLE', frameId, {
            width: 1,
            height: 1,
            fills: [grey(0.4)],
            blendMode: 'MULTIPLY'
          })
        }
      }
    }
    expectChannelsNear(renderCenter(blurred(false), stripes), renderCenter(blurred(true), stripes))
  })
})

describe('background blur and pass-through opacity', () => {
  test('fades the background blur of a translucent shape over the backdrop', () => {
    const blurredShape = (opacity: number): Scene => {
      return (graph, pageId) => {
        graph.createNode('RECTANGLE', pageId, {
          width: SIZE,
          height: SIZE,
          fills: [grey(1, 0.01)],
          opacity,
          effects: [effect('BACKGROUND_BLUR', 4)]
        })
      }
    }
    const backdrop = renderMiddleRowRed(nothing, stripes)
    const opaque = renderMiddleRowRed(blurredShape(1), stripes)
    const half = renderMiddleRowRed(blurredShape(0.5), stripes)
    half.forEach((red, x) => expectNear(red, (opaque[x] + backdrop[x]) / 2))
  })

  test('blurs under a translucent frame whether or not a child blends', () => {
    const blurredFrame = (withBlendingChild: boolean): Scene => {
      return (graph, pageId) => {
        const frame = graph.createNode('FRAME', pageId, {
          width: SIZE,
          height: SIZE,
          fills: [grey(1, 0.01)],
          blendMode: 'PASS_THROUGH',
          opacity: 0.5,
          effects: [effect('BACKGROUND_BLUR', 4)]
        })
        if (withBlendingChild) {
          graph.createNode('RECTANGLE', frame.id, {
            x: SIZE - 1,
            y: SIZE - 1,
            width: 1,
            height: 1,
            fills: [grey(0.4)],
            blendMode: 'MULTIPLY'
          })
        }
      }
    }
    const alone = renderMiddleRowRed(blurredFrame(false), stripes)
    const backdrop = renderMiddleRowRed(nothing, stripes)
    expect(alone).not.toEqual(backdrop)
    expect(renderMiddleRowRed(blurredFrame(true), stripes)).toEqual(alone)
  })

  test('blurs the backdrop up to the edges of a pass-through group with opacity', () => {
    const inset = 8
    const blurredFrame = (opacity: number): Scene => {
      return (graph, pageId) => {
        const frame = graph.createNode('FRAME', pageId, {
          x: inset,
          y: inset,
          width: SIZE - inset * 2,
          height: SIZE - inset * 2,
          fills: [],
          blendMode: 'PASS_THROUGH',
          opacity
        })
        graph.createNode('RECTANGLE', frame.id, {
          width: frame.width,
          height: frame.height,
          fills: [grey(1, 0.01)],
          effects: [effect('BACKGROUND_BLUR', 6)]
        })
      }
    }
    const backdrop = renderMiddleRowRed(nothing, stripes)
    const opaque = renderMiddleRowRed(blurredFrame(1), stripes)
    const half = renderMiddleRowRed(blurredFrame(0.5), stripes)
    half.forEach((red, x) => expectNear(red, (opaque[x] + backdrop[x]) / 2))
  })
})

describe('a render that throws inside a pass-through group with opacity', () => {
  test('closes its saves and leaves later groups blending with the backdrop', () => {
    let brokenId = ''
    const brokenGroup: Scene = (graph, pageId) => {
      brokenId = graph.createNode('RECTANGLE', halfPassThroughFrame(graph, pageId), {
        width: SIZE,
        height: SIZE,
        fills: [grey(0.9)]
      }).id
    }
    const drawShape = renderer.renderShape.bind(renderer)
    const shapes = spyOn(renderer, 'renderShape').mockImplementation((canvas, node, graph) => {
      if (node.id === brokenId) {
        throw new Error('draw failed')
      }
      drawShape(canvas, node, graph)
    })
    const canvas = renderer.surface.getCanvas()
    const entrySaves = canvas.getSaveCount()
    try {
      expect(() => renderScene(brokenGroup, greyBackdrop())).toThrow('draw failed')
    } finally {
      shapes.mockRestore()
    }
    expect(canvas.getSaveCount()).toBe(entrySaves)
    expectNear(renderGroupRed(0.5, PASS_THROUGH_CASES[0].layers), MULTIPLY_AT_HALF)
  })
})

describe('a pass-through layer that throws', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  passThroughGroup(0.5, PASS_THROUGH_CASES[0].layers)(graph, page.id)
  const group = expectDefined(graph.getNode(page.childIds[0]), 'group')
  const canvas = renderer.surface.getCanvas()

  function expectLayerClosedAfter(failure: string, draw: () => void) {
    const saveCount = canvas.getSaveCount()
    const depth = renderer.backdropFreeLayers.length
    expect(() => withNodeLayer(renderer, canvas, graph, group, 0.5, null, draw)).toThrow(failure)
    expect(canvas.getSaveCount()).toBe(saveCount)
    expect(renderer.backdropFreeLayers.length).toBe(depth)
    expect(renderer.opacityPaint.getColor()[3]).toBe(1)
  }

  function expectNextRenderBlends() {
    expectNear(renderGroupRed(0.5, PASS_THROUGH_CASES[0].layers), MULTIPLY_AT_HALF)
  }

  test('closes the saves its draw left open', () => {
    expectLayerClosedAfter('draw failed', () => {
      canvas.save()
      throw new Error('draw failed')
    })
    expectNextRenderBlends()
  })

  test('undoes its setup when the layer fails to open', () => {
    const blender = spyOn(renderer.opacityPaint, 'setBlender').mockImplementation(() => {
      throw new Error('blender failed')
    })
    try {
      expectLayerClosedAfter('blender failed', () => undefined)
    } finally {
      blender.mockRestore()
    }
    expectNextRenderBlends()
  })
})
