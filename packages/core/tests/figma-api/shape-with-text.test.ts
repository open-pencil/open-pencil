import { beforeAll, describe, expect, test } from 'bun:test'

import { pick } from 'es-toolkit'

import { SceneGraph } from '@open-pencil/scene-graph'
import { shapeWithTextFrameFields } from '@open-pencil/scene-graph/generated'

import { registerTestFont } from '#core-tests/helpers/figma-api'

import { FigmaAPI } from '#core/figma-api'

beforeAll(async () => {
  await registerTestFont()
  await new FigmaAPI(new SceneGraph()).loadFontAsync({ family: 'Inter', style: 'Medium' })
})

const RED = [
  { type: 'SOLID' as const, color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
]

function api() {
  return new FigmaAPI(new SceneGraph())
}

function colour(paints: unknown): number[] | undefined {
  if (!Array.isArray(paints)) return undefined
  const [paint] = paints as { color?: { r: number; g: number; b: number } }[]
  return paint?.color ? [paint.color.r, paint.color.g, paint.color.b] : undefined
}

describe('shapes with text in the plugin API', () => {
  // As FigJam's plugin API creates one, measured in FigJam.
  test('a new shape with text is a 176 px ellipse, painted as the shape tool paints one', () => {
    const shape = api().createShapeWithText()
    expect(shape.type).toBe('SHAPE_WITH_TEXT')
    expect(shape.name).toBe('Shape with text')
    expect(shape.shapeType).toBe('ELLIPSE')
    expect([shape.width, shape.height]).toEqual([176, 176])
    expect(colour(shape.fills)).toEqual([1, 1, 1])
    expect(shape.strokeWeight).toBe(4)
    expect(shape.text?.characters).toBe('')
    expect(shape.text?.fontSize).toBe(16)
    expect(shape.text?.textAlignHorizontal).toBe('CENTER')
  })

  test('the shape type changes the kind and refuses names FigJam does not have', () => {
    const shape = api().createShapeWithText()
    shape.shapeType = 'ENG_DATABASE'
    expect(shape.shapeType).toBe('ENG_DATABASE')
    // The label moves into the new kind's label area, as FigJam's shape switcher puts it.
    const fields = shapeWithTextFrameFields('ENG_DATABASE', 176, 176)
    expect(pick(fields, ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'])).toEqual({
      paddingTop: shape.paddingTop,
      paddingRight: shape.paddingRight,
      paddingBottom: shape.paddingBottom,
      paddingLeft: shape.paddingLeft
    })
    expect(() => {
      shape.shapeType = 'CLOUD' as never
    }).toThrow(
      `in set_shapeType: Property "shapeType" failed validation: Invalid enum value. Expected 'SQUARE' | 'ELLIPSE'`
    )
  })

  test('the label is a text layer of its own, whose fills colour the words, not the shape', () => {
    const shape = api().createShapeWithText()
    const before = colour(shape.fills)
    const label = shape.text
    if (!label) throw new Error('no label')
    label.characters = 'Check stock'
    label.fills = RED
    expect(shape.text?.characters).toBe('Check stock')
    expect(colour(label.fills)).toEqual([1, 0, 0])
    expect(colour(shape.fills)).toEqual(before)
  })

  test('fills set on an empty label colour the words typed afterwards', () => {
    const label = api().createShapeWithText().text
    if (!label) throw new Error('no label')
    label.fills = RED
    label.characters = 'Later'
    expect(colour(label.fills)).toEqual([1, 0, 0])
  })

  test("the label is not one of the shape's children", () => {
    const shape = api().createShapeWithText()
    expect(shape.children).toEqual([])
  })

  test('a resize sets the size, as FigJam keeps it', () => {
    const shape = api().createShapeWithText()
    shape.resize(160, 90)
    expect([shape.width, shape.height]).toEqual([160, 90])
  })

  test('other layers have no shape type and no label', () => {
    const rectangle = api().createRectangle()
    expect(rectangle.shapeType).toBeUndefined()
    expect(rectangle.text).toBeUndefined()
    expect(() => {
      rectangle.shapeType = 'SQUARE'
    }).toThrow('Only a shape with text has a shape type')
  })
})
