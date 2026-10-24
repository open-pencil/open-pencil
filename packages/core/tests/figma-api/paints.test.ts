import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Fill } from '@open-pencil/scene-graph'

import { FigmaAPI } from '#core/figma-api'

const STOPS = [
  { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
  { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
]

/** What the proxies' paint types ask of a gradient beside its stops and transform. */
const GRADIENT = { color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }

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
      ...GRADIENT,
      type: 'GRADIENT_LINEAR' as const,
      gradientTransform: SWAPPED,
      gradientStops: STOPS
    }
    // Strokes carry the node's weight and alignment too, which Figma's paint type leaves out.
    const stroke = { ...paint, weight: 1, align: 'CENTER' as const }
    rectangle.fills = [paint]
    rectangle.strokes = [stroke]
    expect(rectangle.fills).toEqual([expect.objectContaining({ gradientTransform: SWAPPED })])
    expect(rectangle.strokes).toEqual([expect.objectContaining({ gradientTransform: SWAPPED })])
    const stored = { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 }
    expect(graph.getNode(rectangle.id)?.fills[0].gradientTransform).toEqual(stored)
    expect(graph.getNode(rectangle.id)?.strokes[0].gradientTransform).toEqual(stored)
  })

  test('round-trips from one layer to another', () => {
    const { figma } = api()
    const source = figma.createRectangle()
    source.fills = [
      { ...GRADIENT, type: 'GRADIENT_RADIAL', gradientTransform: SWAPPED, gradientStops: STOPS }
    ]
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
      failure(
        'fills',
        '[0].gradientTransform',
        'Too small: expected array to have exactly 2 items'
      )
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
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: 'hash',
          imageScaleMode: 'FILL'
        }
      ]
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
      ...GRADIENT,
      type: 'GRADIENT_LINEAR',
      gradientStops: STOPS,
      gradientTransform: { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 }
    }
    const rectangle = figma.createRectangle()
    graph.updateNode(rectangle.id, {
      fills: [
        gradient,
        { ...GRADIENT, type: 'IMAGE', imageHash: 'hash', imageScaleMode: 'FILL' },
        { ...GRADIENT, type: 'SOLID' }
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
      expect.objectContaining({ color: { r: 0, g: 0, b: 1, a: 1 } })
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
