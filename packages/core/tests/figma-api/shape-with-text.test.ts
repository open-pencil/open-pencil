import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

const RED = [{ type: 'SOLID' as const, color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]

function api() {
  return new FigmaAPI(new SceneGraph())
}

function colour(paints: unknown): number[] | undefined {
  if (!Array.isArray(paints)) return undefined
  const [paint] = paints as { color?: { r: number; g: number; b: number } }[]
  return paint?.color ? [paint.color.r, paint.color.g, paint.color.b] : undefined
}

describe('shapes with text in the plugin API', () => {
  test('a new shape with text is a 208 px square with an empty, centred label', () => {
    const shape = api().createShapeWithText()
    expect(shape.type).toBe('SHAPE_WITH_TEXT')
    expect(shape.shapeType).toBe('SQUARE')
    expect([shape.width, shape.height]).toEqual([208, 208])
    expect(shape.text?.characters).toBe('')
    expect(shape.text?.textAlignHorizontal).toBe('CENTER')
  })

  test('the shape type changes the kind and refuses names FigJam does not have', () => {
    const shape = api().createShapeWithText()
    shape.shapeType = 'ENG_DATABASE'
    expect(shape.shapeType).toBe('ENG_DATABASE')
    expect(() => {
      shape.shapeType = 'CLOUD' as never
    }).toThrow('Invalid shape type "CLOUD"')
  })

  test('the label is a text layer of its own, whose fills colour the words, not the shape', () => {
    const shape = api().createShapeWithText()
    const before = colour(shape.fills)
    const label = shape.text
    if (!label) throw new Error('no label')
    expect(label.type).toBe('TEXT')
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

  test('the label is not one of the shape\'s children', () => {
    const shape = api().createShapeWithText()
    expect(shape.children).toEqual([])
  })

  test('a shape grows to fit its label and returns to the height it was given', () => {
    const shape = api().createShapeWithText()
    shape.resize(120, 60)
    const label = shape.text
    if (!label) throw new Error('no label')
    label.characters = 'A label long enough to need several lines inside this small box'
    expect(shape.height).toBeGreaterThan(60)
    label.characters = 'Short'
    expect(shape.height).toBe(60)
  })

  test('a resize sets the height the shape returns to', () => {
    const shape = api().createShapeWithText()
    const label = shape.text
    if (!label) throw new Error('no label')
    label.characters = 'Short'
    shape.resize(160, 90)
    expect(shape.height).toBe(90)
    shape.resize(160, 20)
    expect(shape.height).toBeGreaterThan(20)
  })

  test('a word too long for the shape widens it instead of being split', () => {
    const shape = api().createShapeWithText()
    shape.resize(60, 60)
    const label = shape.text
    if (!label) throw new Error('no label')
    label.characters = 'Internationalisation'
    expect(shape.width).toBeGreaterThan(60)
    label.characters = 'Go'
    expect([shape.width, shape.height]).toEqual([60, 60])
  })

  test('a diamond grows in proportion instead of only taller', () => {
    const shape = api().createShapeWithText()
    shape.shapeType = 'DIAMOND'
    shape.resize(120, 80)
    const label = shape.text
    if (!label) throw new Error('no label')
    label.characters = 'Is the order paid in full yet?'
    expect(shape.width).toBeGreaterThan(120)
    expect(shape.width / shape.height).toBeCloseTo(1.5, 1)
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
