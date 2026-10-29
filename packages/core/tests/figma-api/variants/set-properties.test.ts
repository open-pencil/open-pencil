import { beforeAll, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

import { registerTestFont } from '#core-tests/helpers/figma-api'

beforeAll(() => registerTestFont())

// Recorded with the same script in Figma desktop 126.

function setup() {
  const figma = new FigmaAPI(new SceneGraph())
  const labels: ReturnType<FigmaAPI['createText']>[] = []
  const variant = (size: string, state: string, width: number) => {
    const component = figma.createComponent()
    component.name = `Size=${size}, State=${state}`
    component.resize(width, 40)
    const label = figma.createText()
    label.name = 'Label'
    label.characters = `${size} ${state}`
    component.appendChild(label)
    labels.push(label)
    return component
  }
  const variants = [
    variant('Small', 'Default', 80),
    variant('Large', 'Default', 160),
    variant('Small', 'Hover', 80)
  ]
  const set = figma.combineAsVariants(variants, figma.currentPage)
  const text = set.addComponentProperty('Text', 'TEXT', 'Click')
  for (const label of labels) label.componentPropertyReferences = { characters: text }
  const icon = figma.createComponent()
  const swap = set.addComponentProperty('Icon', 'INSTANCE_SWAP', icon.id)
  const instance = variants[0].createInstance()
  instance.setProperties({ [text]: 'Buy' })
  const state = () => ({
    main: instance.mainComponent?.name,
    text: instance.componentProperties[text]?.value,
    width: instance.width
  })
  return { instance, text, swap, state }
}

test('setProperties switches variants, one value or several, and keeps other properties', () => {
  const { instance, text, state } = setup()
  instance.setProperties({ Size: 'Large' })
  expect(state()).toEqual({ main: 'Size=Large, State=Default', text: 'Buy', width: 160 })
  instance.setProperties({ Size: 'Small', State: 'Hover' })
  expect(state()).toEqual({ main: 'Size=Small, State=Hover', text: 'Buy', width: 80 })
  instance.setProperties({ Size: 'Small', State: 'Default', [text]: 'Again' })
  expect(state()).toEqual({ main: 'Size=Small, State=Default', text: 'Again', width: 80 })
})

test('setProperties changes nothing when no variant has the values, or a name is unknown', () => {
  const { instance, text, state } = setup()
  instance.setProperties({ State: 'Hover' })
  const before = state()
  const missing = 'in setProperties: Unable to find a variant with those property values'
  expect(() => instance.setProperties({ Size: 'Large' })).toThrow(missing)
  expect(() => instance.setProperties({ Size: 'Nope' })).toThrow(missing)
  expect(() => instance.setProperties({ [text]: 'Lost', State: 'Bogus' })).toThrow(missing)
  expect(() => instance.setProperties({ Colour: 'Red' })).toThrow(
    "in setProperties: Could not find a component property with name: 'Colour'"
  )
  expect(state()).toEqual(before)
})

test('setProperties changes nothing when an instance swap value is no component', () => {
  const { instance, text, swap, state } = setup()
  const before = state()
  expect(() =>
    instance.setProperties({ Size: 'Large', [text]: 'Lost', [swap]: 'missing' })
  ).toThrow('Unable to apply component property: Icon')
  expect(state()).toEqual(before)
})
