import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { FigmaAPI } from '#core/figma-api'

// Messages measured with the same assignments in Figma desktop 126's plugin API.
const refused = (property: string, problem: string) =>
  `in set_${property}: Property "${property}" failed validation: ${problem}`

const options = (...values: string[]) =>
  `Invalid option: expected one of ${values.map((value) => `"${value}"`).join('|')}`

const BLEND_MODES = options(
  'PASS_THROUGH',
  'NORMAL',
  'DARKEN',
  'MULTIPLY',
  'LINEAR_BURN',
  'COLOR_BURN',
  'LIGHTEN',
  'SCREEN',
  'LINEAR_DODGE',
  'COLOR_DODGE',
  'OVERLAY',
  'SOFT_LIGHT',
  'HARD_LIGHT',
  'DIFFERENCE',
  'EXCLUSION',
  'HUE',
  'SATURATION',
  'COLOR',
  'LUMINOSITY'
)

const CASES: [property: string, value: unknown, problem: string][] = [
  ['name', 9, 'Expected string, received number'],
  ['name', null, 'Expected string, received null'],
  ['visible', 'yes', 'Expected boolean, received string'],
  ['locked', 1, 'Expected boolean, received number'],
  ['clipsContent', 'x', 'Expected boolean, received string'],
  ['blendMode', 'FOO', BLEND_MODES],
  ['blendMode', 9, BLEND_MODES],
  ['counterAxisAlignItems', 'STRETCH', options('MIN', 'MAX', 'CENTER', 'BASELINE')],
  ['layoutWrap', true, options('NO_WRAP', 'WRAP')],
  ['layoutPositioning', 'FOO', options('AUTO', 'ABSOLUTE')],
  ['itemReverseZIndex', 'x', 'Expected boolean, received string'],
  ['strokesIncludedInLayout', 1, 'Expected boolean, received number'],
  ['layoutAlign', 'FOO', options('MIN', 'CENTER', 'MAX', 'STRETCH', 'INHERIT')],
  [
    'constraints',
    { horizontal: 'FOO', vertical: 'MIN' },
    `${options('MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE')} at .horizontal`
  ],
  [
    'strokeCap',
    'FOO',
    options(
      'NONE',
      'ROUND',
      'SQUARE',
      'ARROW_LINES',
      'ARROW_EQUILATERAL',
      'DIAMOND_FILLED',
      'TRIANGLE_FILLED',
      'CIRCLE_FILLED'
    )
  ],
  ['strokeJoin', 'FOO', options('MITER', 'BEVEL', 'ROUND')],
  ['constrainProportions', 'x', 'Expected boolean, received string']
]

function autoLayoutFrame() {
  const graph = new SceneGraph()
  const frame = new FigmaAPI(graph).createFrame()
  frame.layoutMode = 'HORIZONTAL'
  return { graph, frame }
}

describe('a layer field set to a value of the wrong kind', () => {
  for (const [property, value, problem] of CASES) {
    test(`refuses ${JSON.stringify(value)} for ${property} and keeps the layer as it was`, () => {
      const { graph, frame } = autoLayoutFrame()
      const before = structuredClone(graph.getNode(frame.id))
      expect(() => Reflect.set(frame, property, value)).toThrow(refused(property, problem))
      expect(graph.getNode(frame.id)).toEqual(before)
    })
  }

  test('refuses characters that are not a string, before it asks for fonts', () => {
    const graph = new SceneGraph()
    const text = new FigmaAPI(graph).createText()
    expect(() => Reflect.set(text, 'characters', 9)).toThrow(
      refused('characters', 'Expected string, received number')
    )
    expect(graph.getNode(text.id)?.text).toBe('')
  })

  test('takes the values Figma takes', () => {
    const { frame } = autoLayoutFrame()
    frame.name = 'Card'
    frame.blendMode = 'MULTIPLY'
    frame.counterAxisAlignItems = 'BASELINE'
    frame.layoutWrap = 'WRAP'
    frame.layoutAlign = 'INHERIT'
    frame.constraints = { horizontal: 'SCALE', vertical: 'STRETCH' }
    frame.strokeCap = 'ROUND'
    frame.visible = false
    expect({
      name: frame.name,
      blendMode: frame.blendMode,
      counterAxisAlignItems: frame.counterAxisAlignItems,
      layoutWrap: frame.layoutWrap,
      layoutAlign: frame.layoutAlign,
      constraints: frame.constraints,
      strokeCap: frame.strokeCap,
      visible: frame.visible
    }).toEqual({
      name: 'Card',
      blendMode: 'MULTIPLY',
      counterAxisAlignItems: 'BASELINE',
      layoutWrap: 'WRAP',
      layoutAlign: 'INHERIT',
      constraints: { horizontal: 'SCALE', vertical: 'STRETCH' },
      strokeCap: 'ROUND',
      visible: false
    })
  })
})
