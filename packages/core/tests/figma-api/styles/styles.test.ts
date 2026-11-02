import { beforeAll, describe, expect, test } from 'bun:test'

import { createAPI, registerTestFont } from '#core-tests/helpers/figma-api'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { getSharedStyles } from '@open-pencil/scene-graph/shared-styles'

// Measured with the same scripts in Figma's plugin API (Figma desktop 126).

beforeAll(async () => {
  await registerTestFont('Inter')
  await initCodec()
})

const RED = { r: 1, g: 0, b: 0 }
const GREEN = { r: 0, g: 1, b: 0 }
const BLUE = { r: 0, g: 0, b: 1 }
const solid = (color: typeof RED) => [{ type: 'SOLID' as const, color }]

/** A font name that is not mixed, as a style's and an unstyled text's are. */
function fontName(node: { fontName: unknown }): { family: string; style: string } {
  const name = node.fontName
  if (!name || typeof name !== 'object') throw new Error('Expected one font name')
  return name as { family: string; style: string }
}

describe('creating and finding styles', () => {
  test('a new style is empty and unnamed, with an ID in Figma’s shape', () => {
    const figma = createAPI()
    const paint = figma.createPaintStyle()
    expect(paint.id).toMatch(/^S:[0-9a-f]{40},$/)
    expect(paint.key).toBe(paint.id.slice(2, 42))
    expect([paint.type, paint.name, paint.description, paint.remote]).toEqual([
      'PAINT',
      '',
      '',
      false
    ])
    expect(paint.paints).toEqual([])
    expect(paint.boundVariables).toEqual({})
    expect([figma.createEffectStyle().effects, figma.createGridStyle().layoutGrids]).toEqual([
      [],
      []
    ])
    const text = figma.createTextStyle()
    expect([text.type, text.fontSize, fontName(text).family, text.lineHeight]).toEqual([
      'TEXT',
      12,
      'Inter',
      { unit: 'AUTO' }
    ])
  })

  test('local styles list in the order they were made, and an ID finds the same object', async () => {
    const figma = createAPI()
    for (const name of ['Zeta', 'alpha', 'Beta']) figma.createPaintStyle().name = name
    figma.createTextStyle().name = 'Body'
    expect((await figma.getLocalPaintStylesAsync()).map((style) => style.name)).toEqual([
      'Zeta',
      'alpha',
      'Beta'
    ])
    expect(figma.getLocalTextStyles().map((style) => style.name)).toEqual(['Body'])
    const [first] = figma.getLocalPaintStyles()
    expect(await figma.getStyleByIdAsync(first.id)).toBe(first)
    expect(figma.getStyleById(first.id)).toBe(first)
    expect(await figma.getStyleByIdAsync('S:missing,')).toBeNull()
    expect(await figma.getStyleByIdAsync(3 as never)).toBeNull()
  })

  test('styles stay out of the pages and layers scripts walk', () => {
    const figma = createAPI()
    figma.createPaintStyle().name = 'Hidden'
    expect(figma.root.children.map((page) => page.name)).toEqual(['Page 1'])
    expect(figma.currentPage.children).toEqual([])
  })

  test('names and paints are checked as Figma checks them; a description that is not text is ignored', () => {
    const style = createAPI().createPaintStyle()
    expect(() => (style.name = 3 as never)).toThrow(
      'in set_name: Property "name" failed validation: Expected string, received number'
    )
    expect(() => (style.paints = [{ type: 'NOPE' }] as never)).toThrow(
      'in set_paints: Property "paints" failed validation: Expected [0].type to be one of the following:'
    )
    style.description = 'Main'
    style.description = 3 as never
    expect(style.description).toBe('Main')
  })
})

describe('using styles', () => {
  test('a layer takes the style’s paints, follows its changes, and lists as a consumer', async () => {
    const figma = createAPI()
    const style = figma.createPaintStyle()
    style.paints = solid(RED)
    const first = figma.createRectangle()
    const second = figma.createRectangle()
    expect(await first.setFillStyleIdAsync(style.id)).toBeUndefined()
    second.fillStyleId = style.id
    expect([first.fillStyleId, first.fills]).toMatchObject([style.id, solid(RED)])
    style.paints = solid(GREEN)
    expect([first.fills, second.fills]).toMatchObject([solid(GREEN), solid(GREEN)])
    expect(
      (await style.getStyleConsumersAsync()).map(({ node, fields }) => [node.id, fields])
    ).toEqual([
      [first.id, ['fillStyleId']],
      [second.id, ['fillStyleId']]
    ])
  })

  test('a paint style strokes a layer too', async () => {
    const figma = createAPI()
    const style = figma.createPaintStyle()
    style.paints = solid(BLUE)
    const rectangle = figma.createRectangle()
    await rectangle.setStrokeStyleIdAsync(style.id)
    expect([rectangle.strokeStyleId, rectangle.strokes]).toMatchObject([style.id, solid(BLUE)])
  })

  test('a layer leaves the style when its own paints change or the ID is empty, keeping them', async () => {
    const figma = createAPI()
    const style = figma.createPaintStyle()
    style.paints = solid(RED)
    const rectangle = figma.createRectangle()
    await rectangle.setFillStyleIdAsync(style.id)
    rectangle.fills = solid(BLUE)
    expect(rectangle.fillStyleId).toBe('')
    await rectangle.setFillStyleIdAsync(style.id)
    await rectangle.setFillStyleIdAsync('')
    expect([rectangle.fillStyleId, rectangle.fills]).toMatchObject(['', solid(RED)])
  })

  test('a style the document does not hold, or of another kind, is refused', async () => {
    const figma = createAPI()
    const rectangle = figma.createRectangle()
    const effect = figma.createEffectStyle()
    const refusal = 'Cannot set style successfully: Cannot find style'
    await expect(rectangle.setFillStyleIdAsync('S:missing,')).rejects.toThrow(refusal)
    await expect(rectangle.setFillStyleIdAsync(effect.id)).rejects.toThrow(refusal)
    expect(() => (rectangle.fillStyleId = 'S:missing,')).toThrow(`in set_fillStyleId: ${refusal}`)
    expect(() => (rectangle.fillStyleId = 3 as never)).toThrow(
      'in set_fillStyleId: Property "fillStyleId" failed validation: Expected string, received number'
    )
    expect(await rectangle.setFillStyleIdAsync(3 as never)).toBeUndefined()
  })

  test('a stroke style gives every paint, keeping the stroke’s weight, and an empty one clears it', async () => {
    const figma = createAPI()
    const gradient = figma.createPaintStyle()
    gradient.paints = [
      {
        type: 'GRADIENT_LINEAR',
        gradientTransform: [
          [1, 0, 0],
          [0, 1, 0]
        ],
        gradientStops: [
          { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
          { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
        ]
      }
    ]
    const rectangle = figma.createRectangle()
    rectangle.strokes = solid(GREEN)
    rectangle.strokeWeight = 3
    await rectangle.setStrokeStyleIdAsync(gradient.id)
    expect([rectangle.strokes.map((stroke) => stroke.type), rectangle.strokeWeight]).toEqual([
      ['GRADIENT_LINEAR'],
      3
    ])
    await rectangle.setStrokeStyleIdAsync(figma.createPaintStyle().id)
    expect([rectangle.strokes, rectangle.strokeWeight]).toEqual([[], 3])
    // Without strokes, the layer's kept weight and alignment go to the new ones.
    rectangle.strokeAlign = 'OUTSIDE'
    await rectangle.setStrokeStyleIdAsync(gradient.id)
    expect([rectangle.strokes.length, rectangle.strokeWeight, rectangle.strokeAlign]).toEqual([
      1,
      3,
      'OUTSIDE'
    ])
  })

  test('a paint bound to a variable keeps it in the style and in the layers that use it', async () => {
    const figma = createAPI()
    const collection = figma.variables.createVariableCollection('Colors')
    const brand = figma.variables.createVariable('Brand', collection, 'COLOR')
    brand.setValueForMode(collection.defaultModeId, { r: 1, g: 0, b: 0, a: 1 })
    const style = figma.createPaintStyle()
    style.paints = [
      figma.variables.setBoundVariableForPaint(
        { type: 'SOLID', color: { r: 0, g: 0, b: 0 } },
        'color',
        brand
      )
    ]
    const [paint] = style.paints
    expect(paint && 'boundVariables' in paint ? paint.boundVariables?.color?.id : null).toBe(
      brand.id
    )
    const rectangle = figma.createRectangle()
    await rectangle.setFillStyleIdAsync(style.id)
    expect(rectangle.fills).toMatchObject([
      { color: RED, boundVariables: { color: { id: brand.id } } }
    ])
    brand.setValueForMode(collection.defaultModeId, { r: 0, g: 1, b: 0, a: 1 })
    expect(rectangle.fills).toMatchObject([{ color: GREEN }])
  })

  test('a connector’s stroke style strokes its line', async () => {
    const figma = createAPI()
    const style = figma.createPaintStyle()
    style.paints = solid(BLUE)
    const connector = figma.createConnector()
    await connector.setStrokeStyleIdAsync(style.id)
    expect([connector.strokeStyleId, connector.strokes]).toMatchObject([style.id, solid(BLUE)])
  })

  test('effect and grid styles give their effects and grids', async () => {
    const figma = createAPI()
    const effect = figma.createEffectStyle()
    effect.effects = [{ type: 'LAYER_BLUR', radius: 4, visible: true, blurType: 'NORMAL' }]
    const grid = figma.createGridStyle()
    grid.layoutGrids = [
      { pattern: 'GRID', sectionSize: 8, visible: true, color: { r: 1, g: 0, b: 0, a: 0.1 } }
    ]
    const frame = figma.createFrame()
    await frame.setEffectStyleIdAsync(effect.id)
    await frame.setGridStyleIdAsync(grid.id)
    expect(frame.effects).toMatchObject([{ type: 'LAYER_BLUR', radius: 4 }])
    expect(frame.layoutGrids).toMatchObject([{ pattern: 'GRID', sectionSize: 8 }])
    expect(() => (effect.effects = 3 as never)).toThrow(
      'in set_effects: Property "effects" failed validation: Expected array, received number'
    )
    expect(() => (grid.layoutGrids = 3 as never)).toThrow(
      'in set_layoutGrids: Property "layoutGrids" failed validation: Expected array, received number'
    )
  })

  test('each layer has the style references Figma gives its type', () => {
    const figma = createAPI()
    const has = (node: object, members: string[]) => members.map((member) => member in node)
    expect(
      has(figma.createRectangle(), ['fillStyleId', 'effectStyleId', 'gridStyleId', 'textStyleId'])
    ).toEqual([true, true, false, false])
    expect(has(figma.currentPage, ['fillStyleId', 'effectStyleId'])).toEqual([false, false])
    expect(has(figma.createText(), ['textStyleId', 'gridStyleId'])).toEqual([true, false])
    expect(has(figma.createFrame(), ['gridStyleId', 'backgroundStyleId', 'textStyleId'])).toEqual([
      true,
      true,
      false
    ])
    const group = figma.group([figma.createRectangle()], figma.currentPage)
    expect(has(group, ['fillStyleId', 'effectStyleId'])).toEqual([false, true])
  })
})

describe('text styles', () => {
  test('give a whole text their fields over its ranges, and follow their changes', async () => {
    const figma = createAPI()
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
    await figma.loadFontAsync({ family: 'Inter', style: 'Bold' })
    const style = figma.createTextStyle()
    style.fontName = { family: 'Inter', style: 'Bold' }
    style.fontSize = 24
    style.textCase = 'UPPER'
    const text = figma.createText()
    text.characters = 'abc def'
    text.setRangeFontSize(0, 3, 40)
    await text.setTextStyleIdAsync(style.id)
    expect([text.textStyleId, text.fontSize, fontName(text).style, text.textCase]).toEqual([
      style.id,
      24,
      'Bold',
      'UPPER'
    ])
    style.fontSize = 30
    expect(text.fontSize).toBe(30)
    text.fontSize = 10
    expect(text.textStyleId).toBe('')
  })

  test('reach the ranges that use them, which are not listed as consumers', async () => {
    const figma = createAPI()
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
    const paint = figma.createPaintStyle()
    paint.paints = solid(RED)
    const style = figma.createTextStyle()
    const text = figma.createText()
    text.characters = 'Hello world'
    await text.setRangeFillStyleIdAsync(0, 5, paint.id)
    await text.setRangeTextStyleIdAsync(6, 11, style.id)
    expect(await paint.getStyleConsumersAsync()).toEqual([])
    paint.paints = solid(BLUE)
    style.fontSize = 30
    expect(text.getRangeFills(0, 5)).toMatchObject(solid(BLUE))
    expect([text.getRangeFontSize(6, 11), text.getRangeFontSize(0, 5)]).toEqual([30, 12])
  })

  test('a range refuses a style the document does not hold', async () => {
    const figma = createAPI()
    const text = figma.createText()
    text.characters = 'Hello'
    expect(() => text.setRangeFillStyleId(0, 3, 'S:missing,')).toThrow(
      'in setRangeFillStyleId: Cannot set style successfully: Cannot find style'
    )
    await expect(text.setRangeTextStyleIdAsync(0, 3, 'S:missing,')).rejects.toThrow(
      'Cannot set style successfully: Cannot find style'
    )
  })
})

describe('styles inside instances', () => {
  test('a text inside an instance that uses a style follows it and lets it go, as an override', async () => {
    const figma = createAPI()
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
    const style = figma.createTextStyle()
    const component = figma.createComponent()
    const label = figma.createText()
    label.characters = 'Label'
    component.appendChild(label)
    const instance = component.createInstance()
    const copy = instance.findOne((node) => node.type === 'TEXT')
    if (!copy) throw new Error('Expected the instance’s text')
    await copy.setTextStyleIdAsync(style.id)
    const overridden = () => instance.overrides?.map((override) => override.overriddenFields)
    const before = overridden()
    style.fontSize = 30
    expect(copy.fontSize).toBe(30)
    expect(overridden()).toEqual(before)
    style.remove()
    expect(copy.textStyleId).toBe('')
    expect(copy.fontSize).toBe(30)
  })
})

describe('removing a style', () => {
  test('leaves what used it its values, and the style refuses to be read', async () => {
    const figma = createAPI()
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
    const style = figma.createPaintStyle()
    style.paints = solid(GREEN)
    const rectangle = figma.createRectangle()
    await rectangle.setFillStyleIdAsync(style.id)
    const text = figma.createText()
    text.characters = 'Hello'
    await text.setRangeFillStyleIdAsync(0, 3, style.id)
    const { id } = style
    style.remove()
    expect([rectangle.fillStyleId, rectangle.fills]).toMatchObject(['', solid(GREEN)])
    expect([text.getRangeFillStyleId(0, 3), text.getRangeFills(0, 3)]).toMatchObject([
      '',
      solid(GREEN)
    ])
    expect(await figma.getStyleByIdAsync(id)).toBeNull()
    expect(() => style.name).toThrow(`in get_name: The style with id "${id}" does not exist`)
    expect(() => style.remove()).toThrow(`in remove: The style with id "${id}" does not exist`)
  })
})

test('a style made by a script is saved with the file and the layers that use it', async () => {
  const figma = createAPI()
  const style = figma.createPaintStyle()
  style.name = 'Brand/Primary'
  style.paints = solid(RED)
  const rectangle = figma.createRectangle()
  rectangle.name = 'Card'
  await rectangle.setFillStyleIdAsync(style.id)
  const saved = await exportFigFile(figma.graph)
  const reopened = await parseFigFile(saved.slice().buffer)
  const [found] = getSharedStyles(reopened, 'fill')
  expect(found?.name).toBe('Brand/Primary')
  expect(reopened.getNode(found?.nodeId ?? '')?.fills).toMatchObject([
    { type: 'SOLID', color: { r: 1, g: 0, b: 0 } }
  ])
  const card = [...reopened.getAllNodes()].find((node) => node.name === 'Card')
  expect(card?.fillStyleId).toBe(found?.id)
})
