import { beforeAll, describe, expect, test } from 'bun:test'

import { FigmaAPI, type FigmaNodeProxy } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

import { registerTestFont } from '#core-tests/helpers/figma-api'

beforeAll(() => registerTestFont())

// Each case repeats a script run in Figma desktop 126; the lists are what Figma returned.

const solid = (r: number, g: number, b: number) => ({
  type: 'SOLID' as const,
  color: { r, g, b, a: 1 },
  opacity: 1,
  visible: true
})

function setup() {
  const figma = new FigmaAPI(new SceneGraph())
  const icon = figma.createComponent()
  icon.name = 'Icon'
  icon.resize(16, 16)
  const dot = figma.createEllipse()
  dot.name = 'Dot'
  dot.resize(16, 16)
  icon.appendChild(dot)
  const card = figma.createComponent()
  card.name = 'Card'
  card.resize(200, 120)
  card.layoutMode = 'VERTICAL'
  const label = figma.createText()
  label.name = 'Label'
  label.characters = 'Hello'
  card.appendChild(label)
  const box = figma.createRectangle()
  box.name = 'Box'
  box.resize(50, 20)
  box.fills = [solid(1, 0, 0)]
  card.appendChild(box)
  const row = figma.createFrame()
  row.name = 'Row'
  row.layoutMode = 'HORIZONTAL'
  row.resize(100, 30)
  card.appendChild(row)
  const nested = icon.createInstance()
  nested.name = 'Nested'
  row.appendChild(nested)
  const show = card.addComponentProperty('Show', 'BOOLEAN', true)
  box.componentPropertyReferences = { visible: show }
  const instance = card.createInstance()
  const find = (name: string) => {
    const found = instance.findOne((node: FigmaNodeProxy) => node.name === name)
    if (!found) throw new Error(`Missing ${name}`)
    return found
  }
  // Names each entry by its layer, as the Figma script printed them.
  const overrides = () =>
    (instance.overrides ?? []).map((entry) => {
      const layer =
        entry.id === instance.id
          ? 'SELF'
          : instance.findOne((node: FigmaNodeProxy) => node.id === entry.id)?.name
      return `${layer}: ${entry.overriddenFields.join(',')}`
    })
  return { figma, card, instance, find, overrides, show }
}

describe('instance.overrides', () => {
  test('an untouched instance and its component have none to list', () => {
    const { card, overrides } = setup()
    expect(overrides()).toEqual([])
    expect(card.overrides).toBeUndefined()
  })

  test('lists each edited layer once, under Figma’s field names', () => {
    const { find, overrides } = setup()
    find('Box').fills = [solid(0, 1, 0)]
    find('Box').strokeWeight = 3
    find('Box').cornerRadius = 4
    find('Row').primaryAxisAlignItems = 'CENTER'
    find('Row').itemSpacing = 7
    expect(overrides()).toEqual([
      'Box: bottomLeftRadius,bottomRightRadius,cornerRadius,fills,strokeBottomWeight,strokeLeftWeight,strokeRightWeight,stokeTopWeight,strokeWeight,topLeftRadius,topRightRadius',
      'Row: itemSpacing,primaryAxisAlignItems'
    ])
  })

  test('lists the instance’s own size once its layers grow it, and a nested instance’s layers', () => {
    const { find, overrides } = setup()
    find('Label').fontSize = 30
    find('Dot').fills = [solid(0, 0, 1)]
    find('Nested').opacity = 0.5
    expect(overrides()).toEqual([
      'SELF: height,width',
      'Label: fontSize',
      'Nested: opacity',
      'Dot: fills'
    ])
    expect(find('Nested').overrides?.map((entry) => entry.overriddenFields)).toEqual([
      ['opacity'],
      ['fills']
    ])
  })

  test('leaves out a value set to what the layer has and a property’s value, but not the size it gives', () => {
    const { instance, find, overrides, show } = setup()
    find('Label').characters = 'Hello'
    find('Box').fills = [solid(1, 0, 0)]
    expect(overrides()).toEqual([])
    // The hidden box shrinks the hugging instance.
    instance.setProperties({ [show]: false })
    expect(overrides()).toEqual(['SELF: height,width'])
  })
})

describe('instance.resetOverrides', () => {
  test('returns the instance and the ones inside it to their components', () => {
    const { card, instance, find, overrides } = setup()
    find('Dot').fills = [solid(0, 0, 1)]
    find('Label').fontSize = 30
    find('Nested').opacity = 0.5
    instance.resize(260, 160)
    instance.resetOverrides()
    expect(overrides()).toEqual([])
    expect([instance.width, instance.height]).toEqual([card.width, card.height])
    expect([find('Label').fontSize, find('Nested').opacity]).toEqual([12, 1])
    const componentDot = card.findOne((node: FigmaNodeProxy) => node.name === 'Dot')
    expect(find('Dot').fills).toEqual(componentDot?.fills ?? [])
  })

  test('keeps the values component properties set, and the size they give', () => {
    const { instance, find, overrides, show } = setup()
    instance.setProperties({ [show]: false })
    find('Label').fontSize = 30
    instance.resetOverrides()
    expect([find('Box').visible, find('Label').fontSize]).toEqual([false, 12])
    expect(overrides()).toEqual(['SELF: height,width'])
  })

  test('on a nested instance resets only what is inside it', () => {
    const { find, overrides } = setup()
    find('Dot').fills = [solid(0, 0, 1)]
    find('Label').fontSize = 30
    find('Nested').resetOverrides()
    expect(overrides()).toEqual(['SELF: height,width', 'Label: fontSize'])
  })

  test('is an instance’s alone', () => {
    const { card } = setup()
    expect(() => card.resetOverrides()).toThrow('resetOverrides() can only be called on instances')
  })
})
