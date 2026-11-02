import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Fill } from '@open-pencil/scene-graph'

import { FigmaAPI } from '#core/figma-api'

const STOPS = [
  { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
  { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
]

/** What every scene paint holds beside the fields of its type. */
const SCENE_PAINT = { color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }

const SWAPPED = [
  [0, 1, 0],
  [-1, 0, 1]
] as [[number, number, number], [number, number, number]]

function api() {
  const graph = new SceneGraph()
  return { graph, figma: new FigmaAPI(graph) }
}

// Figma's plugin API takes and gives a paint's transforms as two rows of three, as measured with
// the same scripts in Figma.
describe('a gradient transform', () => {
  test('goes in and comes out as two rows of three, on fills and strokes alike', () => {
    const { graph, figma } = api()
    const rectangle = figma.createRectangle()
    const paint = {
      type: 'GRADIENT_LINEAR' as const,
      gradientTransform: SWAPPED,
      gradientStops: STOPS
    }
    rectangle.fills = [paint]
    rectangle.strokes = [paint]
    expect(rectangle.fills).toEqual([expect.objectContaining({ gradientTransform: SWAPPED })])
    expect(rectangle.strokes).toEqual([expect.objectContaining({ gradientTransform: SWAPPED })])
    const stored = { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 }
    expect(graph.getNode(rectangle.id)?.fills[0].gradientTransform).toEqual(stored)
    expect(graph.getNode(rectangle.id)?.strokes[0].gradientTransform).toEqual(stored)
  })

  test('round-trips from one layer to another', () => {
    const { figma } = api()
    const source = figma.createRectangle()
    source.fills = [{ type: 'GRADIENT_RADIAL', gradientTransform: SWAPPED, gradientStops: STOPS }]
    const target = figma.createEllipse()
    target.fills = source.fills
    expect(target.fills).toEqual(source.fills)
  })

  test('is required, and only as rows', () => {
    const rectangle = api().figma.createRectangle()
    const failure = (setter: string, at: string, problem: string) =>
      `in set_${setter}: Property "${setter}" failed validation: Expected ${at} to be one of the ` +
      `following, but none matched:\n  ${problem} at ${at}`
    expect(() => {
      rectangle.fills = [{ type: 'GRADIENT_LINEAR', gradientStops: STOPS }] as never
    }).toThrow(failure('fills', '[0].gradientTransform', 'Required value missing'))
    expect(() => {
      rectangle.strokes = [
        { type: 'SOLID', color: { r: 1, g: 0, b: 0 } },
        {
          type: 'GRADIENT_LINEAR',
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 } as never,
          gradientStops: STOPS
        }
      ] as never
    }).toThrow(failure('strokes', '[1].gradientTransform', 'Expected array, received object'))
    expect(() => {
      rectangle.fills = [
        {
          type: 'GRADIENT_LINEAR',
          gradientTransform: [[1, 0, 0]],
          gradientStops: STOPS
        }
      ] as never
    }).toThrow(
      failure('fills', '[0].gradientTransform', 'Too small: expected array to have exactly 2 items')
    )
    expect(() => {
      rectangle.fills = [
        {
          type: 'GRADIENT_LINEAR',
          gradientTransform: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]
          ],
          gradientStops: STOPS
        }
      ] as never
    }).toThrow(
      failure('fills', '[0].gradientTransform', 'Too big: expected array to have exactly 2 items')
    )
  })
})

describe('an image transform', () => {
  test('reads the identity when the paint has none', () => {
    const { graph, figma } = api()
    const rectangle = figma.createRectangle()
    graph.updateNode(rectangle.id, {
      fills: [{ ...SCENE_PAINT, type: 'IMAGE', imageHash: 'hash', imageScaleMode: 'FILL' }]
    })
    expect(rectangle.fills).toEqual([
      expect.objectContaining({
        imageTransform: [
          [1, 0, 0],
          [0, 1, 0]
        ]
      })
    ])
  })
})

// `get_node`, `get_selection`, and `eval` print a layer through toJSON, so a script reads the same
// paints there as through `fills` and `strokes`, and can assign them back.
describe('a layer printed as JSON', () => {
  // Laid out as a document read from a file holds it, with a colour bound to a variable.
  function paintedRectangle() {
    const { graph, figma } = api()
    const collection = figma.variables.createVariableCollection('Tokens')
    const blue = figma.variables.createVariable('blue', collection, 'COLOR')
    blue.setValueForMode(collection.defaultModeId, { r: 0, g: 0, b: 1 })
    const gradient: Fill = {
      ...SCENE_PAINT,
      type: 'GRADIENT_LINEAR',
      gradientStops: STOPS,
      gradientTransform: { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 }
    }
    const rectangle = figma.createRectangle()
    graph.updateNode(rectangle.id, {
      fills: [
        gradient,
        { ...SCENE_PAINT, type: 'IMAGE', imageHash: 'hash', imageScaleMode: 'FILL' },
        { ...SCENE_PAINT, type: 'SOLID' }
      ],
      strokes: [{ ...gradient, weight: 1, align: 'CENTER' }]
    })
    graph.bindVariable(rectangle.id, 'fills/2/color', blue.id)
    return { figma, rectangle }
  }

  test('prints paints as fills and strokes read them', () => {
    const { rectangle } = paintedRectangle()
    const json = rectangle.toJSON()
    expect(json.fills).toEqual(rectangle.fills)
    expect(json.strokes).toEqual(rectangle.strokes)
    expect(json.fills).toEqual([
      expect.objectContaining({ gradientTransform: SWAPPED }),
      expect.objectContaining({
        imageTransform: [
          [1, 0, 0],
          [0, 1, 0]
        ]
      }),
      expect.objectContaining({ color: { r: 0, g: 0, b: 1 } })
    ])
  })

  test('prints paints a script can assign to another layer', () => {
    const { figma, rectangle } = paintedRectangle()
    const { fills, strokes } = rectangle.toJSON()
    const copy = figma.createRectangle()
    expect(() => {
      copy.fills = fills as never
      copy.strokes = strokes as never
    }).not.toThrow()
    expect(copy.fills).toEqual(rectangle.fills)
    expect(copy.strokes).toEqual(rectangle.strokes)
    expect(copy.boundVariables).toEqual(rectangle.boundVariables)
  })
})

const HASH = 'a'.repeat(40)
const IDENTITY: [[number, number, number], [number, number, number]] = [
  [1, 0, 0],
  [0, 1, 0]
]
const NO_FILTERS = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0
}

/** Assigns `fills` as an untyped script would, so the checks see what Figma's types refuse. */
function setFills(target: object, fills: unknown[]) {
  Reflect.set(target, 'fills', fills)
}

function failure(problem: string, method = 'set_fills', property = 'fills') {
  return `in ${method}: Property "${property}" failed validation: ${problem}`
}

// Recorded in Figma 126 with the same scripts.
describe('a solid paint', () => {
  test('reads an RGB colour, its alpha as the opacity, and no bound variables', () => {
    const { graph, figma } = api()
    const rectangle = figma.createRectangle()
    rectangle.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 }, opacity: 0.5 }]
    expect(rectangle.fills).toEqual([
      {
        type: 'SOLID',
        visible: true,
        opacity: 0.5,
        blendMode: 'NORMAL',
        color: { r: 1, g: 0, b: 0 },
        boundVariables: {}
      }
    ])
    expect(graph.getNode(rectangle.id)?.fills[0]).toMatchObject({
      color: { r: 1, g: 0, b: 0, a: 1 },
      opacity: 0.5
    })
  })

  test("takes a colour's alpha as the opacity it leaves out, on fills and strokes alike", () => {
    const { figma } = api()
    const rectangle = figma.createRectangle()
    setFills(rectangle, [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 0.5 } }])
    Reflect.set(rectangle, 'strokes', [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 0.5 } }])
    const read = { color: { r: 1, g: 0, b: 0 }, opacity: 0.5 }
    expect(rectangle.fills).toEqual([expect.objectContaining(read)])
    expect(rectangle.strokes).toEqual([expect.objectContaining(read)])
    // A paint giving both keeps its opacity.
    setFills(rectangle, [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 0.5 }, opacity: 0.8 }])
    expect(rectangle.fills).toEqual([expect.objectContaining({ opacity: 0.8 })])
  })

  test('refuses what Figma refuses, with its messages', () => {
    const rectangle = api().figma.createRectangle()
    const solid = (fields: object) => [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 }, ...fields }]
    expect(() => setFills(rectangle, solid({ color: '#FF0000' }))).toThrow(
      failure('Expected object, received string at [0].color')
    )
    expect(() => setFills(rectangle, solid({ color: { r: 2, g: 0, b: 0 } }))).toThrow(
      failure('Too big: expected number to be <=1 at [0].color.r')
    )
    expect(() => setFills(rectangle, solid({ opacity: 2 }))).toThrow(
      failure('Too big: expected number to be <=1 at [0].opacity')
    )
    expect(() => setFills(rectangle, solid({ color: { r: 1, g: 0, b: 0, x: 1 } }))).toThrow(
      failure('Unrecognized key: "x" at [0].color')
    )
    expect(() => setFills(rectangle, solid({ foo: 1 }))).toThrow(
      failure('Unrecognized key: "foo" at index 0')
    )
    expect(() => Reflect.set(rectangle, 'strokes', solid({ opacity: 2 }))).toThrow(
      failure('Too big: expected number to be <=1 at [0].opacity', 'set_strokes', 'strokes')
    )
  })
})

describe('an image paint', () => {
  test('reads its scale mode, rotation, scaling, filters, and transform as Figma does', () => {
    const { graph, figma } = api()
    const rectangle = figma.createRectangle()
    rectangle.fills = [{ type: 'IMAGE', imageHash: HASH, scaleMode: 'FIT', rotation: 90 }]
    expect(rectangle.fills).toEqual([
      {
        type: 'IMAGE',
        visible: true,
        opacity: 1,
        blendMode: 'NORMAL',
        scaleMode: 'FIT',
        scalingFactor: 1,
        rotation: 90,
        filters: NO_FILTERS,
        imageTransform: IDENTITY,
        imageHash: HASH
      }
    ])
    // The renderer reads OpenPencil's names, so the image draws fitted and turned.
    expect(graph.getNode(rectangle.id)?.fills[0]).toMatchObject({
      imageScaleMode: 'FIT',
      imageRotation: 90
    })
  })

  test('tiles by its scaling factor', () => {
    const { graph, figma } = api()
    const rectangle = figma.createRectangle()
    rectangle.fills = [{ type: 'IMAGE', imageHash: HASH, scaleMode: 'TILE', scalingFactor: 0.5 }]
    expect(rectangle.fills).toEqual([
      expect.objectContaining({
        scaleMode: 'TILE',
        scalingFactor: 0.5,
        rotation: 0,
        filters: NO_FILTERS,
        imageTransform: IDENTITY
      })
    ])
    expect(graph.getNode(rectangle.id)?.fills[0]).toMatchObject({
      imageScaleMode: 'TILE',
      scale: 0.5
    })
  })

  test('crops by its transform and reads no rotation', () => {
    const { figma } = api()
    const rectangle = figma.createRectangle()
    const crop = [
      [0.5, 0, 0.25],
      [0, 0.5, 0.25]
    ] as [[number, number, number], [number, number, number]]
    rectangle.fills = [{ type: 'IMAGE', imageHash: HASH, scaleMode: 'CROP', imageTransform: crop }]
    const [fill] = rectangle.fills as readonly object[]
    expect(fill).toEqual({
      type: 'IMAGE',
      visible: true,
      opacity: 1,
      blendMode: 'NORMAL',
      scaleMode: 'CROP',
      scalingFactor: 1,
      filters: NO_FILTERS,
      imageTransform: crop,
      imageHash: HASH
    })
    expect(fill).not.toHaveProperty('rotation')
  })

  test('refuses a missing or unknown scale mode, OpenPencil names, and a missing hash', () => {
    const rectangle = api().figma.createRectangle()
    const scaleMode = 'Invalid option: expected one of "FILL"|"FIT"|"CROP"|"TILE" at [0].scaleMode'
    expect(() => setFills(rectangle, [{ type: 'IMAGE', imageHash: HASH }])).toThrow(
      failure(scaleMode)
    )
    expect(() =>
      setFills(rectangle, [{ type: 'IMAGE', imageHash: HASH, scaleMode: 'COVER' }])
    ).toThrow(failure(scaleMode))
    expect(() =>
      setFills(rectangle, [{ type: 'IMAGE', imageHash: HASH, imageScaleMode: 'FIT' }])
    ).toThrow(failure(`${scaleMode}\nUnrecognized key: "imageScaleMode" at index 0`))
    expect(() => setFills(rectangle, [{ type: 'IMAGE', scaleMode: 'FILL' }])).toThrow(
      failure('Required value missing at [0].imageHash')
    )
  })
})

describe('paint types', () => {
  test('a gradient stop colour needs its alpha, unlike a solid colour', () => {
    const rectangle = api().figma.createRectangle()
    expect(() =>
      setFills(rectangle, [
        {
          type: 'GRADIENT_LINEAR',
          gradientTransform: IDENTITY,
          gradientStops: [{ position: 0, color: { r: 1, g: 0, b: 0 } }]
        }
      ])
    ).toThrow(failure('Required value missing at [0].gradientStops[0].color.a'))
  })

  test('fills refuse a pattern, and a video names its hash by SHA-1', () => {
    const rectangle = api().figma.createRectangle()
    expect(() => setFills(rectangle, [{ type: 'PATTERN' }])).toThrow(
      failure(
        'Expected [0].type to be one of the following: SOLID, SHADER, GRADIENT_LINEAR, ' +
          'GRADIENT_RADIAL, GRADIENT_ANGULAR, GRADIENT_DIAMOND, IMAGE, VIDEO'
      )
    )
    expect(() =>
      setFills(rectangle, [{ type: 'VIDEO', videoHash: 'not a hash', scaleMode: 'FILL' }])
    ).toThrow('in set_fills: Invalid SHA1 hash')
  })

  test('a video reads as Figma names its fields', () => {
    const { figma } = api()
    const rectangle = figma.createRectangle()
    rectangle.fills = [{ type: 'VIDEO', videoHash: HASH, scaleMode: 'FILL' }]
    expect(rectangle.fills).toEqual([
      {
        type: 'VIDEO',
        visible: true,
        opacity: 1,
        blendMode: 'NORMAL',
        scaleMode: 'FILL',
        scalingFactor: 1,
        rotation: 0,
        filters: NO_FILTERS,
        videoTransform: IDENTITY,
        videoHash: HASH
      }
    ])
  })
})

describe('a layer with paint styles', () => {
  const RED = { type: 'SOLID' as const, color: { r: 1, g: 0, b: 0 } }

  test('leaves the fill style when a plugin sets its fills, and keeps the stroke style', () => {
    const { graph, figma } = api()
    const rectangle = figma.createRectangle()
    rectangle.strokes = [RED]
    graph.updateNode(rectangle.id, { fillStyleId: 'style:fill', strokeStyleId: 'style:stroke' })

    // A stroke style holds paints only, so the weight is not one of its fields.
    rectangle.strokeWeight = 3
    rectangle.fills = [RED]
    expect(graph.getNode(rectangle.id)).toMatchObject({
      fillStyleId: null,
      strokeStyleId: 'style:stroke'
    })
  })
})
