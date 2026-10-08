import { describe, expect, test } from 'bun:test'

import { FigmaAPI, type FigmaNodeProxy, type FigmaSlotNode } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

/** Figma's typings only expose the slot members on `SlotNode`, so narrow before reading them. */
const isSlot = (node: FigmaNodeProxy): node is FigmaSlotNode => node.type === 'SLOT'

// Defaults, names, read-back values, and limit reports were recorded by running the same
// script against a component in live Figma through figma-use.

function setup() {
  const api = new FigmaAPI(new SceneGraph())
  const component = api.createComponent()
  component.name = 'Card'
  return { api, component }
}

describe('slots', () => {
  test('createSlot appends a 100×100 frame named Slot bound to a new SLOT property', () => {
    const { component } = setup()
    const slot = component.createSlot()

    expect(slot.type).toBe('SLOT')
    expect(slot.name).toBe('Slot')
    expect([slot.width, slot.height]).toEqual([100, 100])
    expect(slot.parent?.id).toBe(component.id)
    const [key] = Object.keys(component.componentPropertyDefinitions)
    expect(key).toStartWith('Slot#')
    expect(component.componentPropertyDefinitions[key]).toMatchObject({
      type: 'SLOT',
      preferredValues: []
    })
    // Figma's typings list only `visible`, `characters` and `mainComponent`; a slot frame also
    // reports the property it is bound to under `slotContentId`.
    const references: Record<string, string | undefined> | null = slot.componentPropertyReferences
    expect(references).toEqual({ slotContentId: key })

    expect(component.createSlot().name).toBe('Slot 2')
  })

  test('instances show the slot, report broken limits, and reset to the component content', () => {
    const { api, component } = setup()
    const slot = component.createSlot()
    slot.appendChild(Object.assign(api.createText(), { name: 'Default' }))
    const [key] = Object.keys(component.componentPropertyDefinitions)
    component.editComponentProperty(key, { slotSettings: { minChildren: 2, maxChildren: 3 } })
    expect(component.componentPropertyDefinitions[key].slotSettings).toEqual({
      stretchChildOnInsert: false,
      displayEmptyByDefault: false,
      minChildren: 2,
      maxChildren: 3,
      allowPreferredValuesOnly: false
    })

    const instance = component.createInstance()
    const instanceSlot = instance.children.find(isSlot)
    if (!instanceSlot) throw new Error('Missing instance slot')
    expect(instanceSlot.children.map((child) => child.name)).toEqual(['Default'])
    expect(instanceSlot.limitViolations).toEqual(['BELOW_MIN'])
    // A main component's slot reports nothing.
    expect(slot.limitViolations).toEqual([])

    instanceSlot.appendChild(Object.assign(api.createFrame(), { name: 'Inner' }))
    instanceSlot.resetSlot()
    const reset = instance.children.find(isSlot)
    expect(reset?.children.map((child) => child.name)).toEqual(['Default'])
  })

  // Recorded in live Figma: an instance's own layers and its slot frames refuse removal;
  // slot content can be removed, which makes the slot the instance's own.
  test('remove() only takes layers out of the slots of an instance', () => {
    const { api, component } = setup()
    component.appendChild(Object.assign(api.createFrame(), { name: 'Locked' }))
    component.createSlot().appendChild(Object.assign(api.createRectangle(), { name: 'Default' }))
    const instance = component.createInstance()
    const locked = instance.children.find((child) => child.name === 'Locked')
    const slot = instance.children.find(isSlot)
    if (!locked || !slot) throw new Error('Missing instance layers')

    expect(() => locked.remove()).toThrow('in remove: Removing this node is not allowed')
    expect(() => slot.remove()).toThrow('in remove: Removing this node is not allowed')
    slot.children[0]?.remove()
    expect(slot.children).toEqual([])
    expect(Object.values(instance.componentProperties)).toHaveLength(1)
  })

  // Recorded in live Figma: resetting a main component's slot neither throws nor changes it.
  test('resetSlot on a main component slot keeps its content', () => {
    const { api, component } = setup()
    const slot = component.createSlot()
    slot.appendChild(Object.assign(api.createText(), { name: 'Main' }))
    slot.resetSlot()
    expect(slot.children.map((child) => child.name)).toEqual(['Main'])
    expect(Object.keys(component.componentPropertyDefinitions)).toHaveLength(1)
  })

  test('addComponentProperty takes a SLOT description and settings, unset counts reading null', () => {
    const { component } = setup()
    const key = component.addComponentProperty('Added', 'SLOT', '', {
      description: 'desc',
      slotSettings: { maxChildren: 1 }
    })
    expect(component.componentPropertyDefinitions[key]).toMatchObject({
      type: 'SLOT',
      description: 'desc',
      slotSettings: { minChildren: null, maxChildren: 1, allowPreferredValuesOnly: false }
    })
    expect(() =>
      component.addComponentProperty('Label', 'TEXT', 'x', { slotSettings: { maxChildren: 1 } })
    ).toThrow("slotSettings is only supported for 'SLOT' properties")
  })

  // Figma returns the copy as a SLOT without references; the typings promise a FrameNode,
  // and OpenPencil, whose slots are frames bound to a property, returns that frame. Figma
  // also moves the copy to the page, so it reads null references; OpenPencil's clone stays
  // beside the original, inside the component, where it binds nothing.
  test('a cloned slot is a plain frame bound to nothing', () => {
    const { component } = setup()
    const copy = component.createSlot().clone()
    expect(copy.type).toBe('FRAME')
    expect(copy.componentPropertyReferences).toEqual({})
    expect(Object.keys(component.componentPropertyDefinitions)).toHaveLength(1)
  })

  test('createSlot is only for components', () => {
    const { api, component } = setup()
    // Only components declare createSlot; a script can still call it on another node.
    const { createSlot } = component
    expect(() => createSlot.call(api.createFrame())).toThrow(
      'createSlot() can only be called on components'
    )
  })
})

describe('swapping an instance', () => {
  /** An outer component holding a Card instance named `innerName`, whose slot has a layer. */
  function outerWithFilledSlot(innerName: string) {
    const { api, component: card } = setup()
    card.createSlot()
    const outer = (name: string, nestedName: string) => {
      const component = api.createComponent()
      component.name = name
      component.appendChild(Object.assign(card.createInstance(), { name: nestedName }))
      return component
    }
    const instance = outer('Outer A', 'Card').createInstance()
    const nestedSlot = () => instance.children[0]?.children.find(isSlot)
    nestedSlot()?.appendChild(Object.assign(api.createText(), { name: 'Filled' }))
    return {
      instance,
      nestedSlot,
      same: outer('Outer B', 'Card'),
      other: outer('Outer C', innerName)
    }
  }

  // Recorded in live Figma: nested slot content follows a nested instance of the same name.
  test('keeps a nested instance’s slot content when the new component nests one of the same name', () => {
    const { instance, nestedSlot, same, other } = outerWithFilledSlot('Other name')
    instance.swapComponent(same)
    expect(nestedSlot()?.children.map((child) => child.name)).toEqual(['Filled'])
    instance.swapComponent(other)
    expect(nestedSlot()?.children.map((child) => child.name)).toEqual([])
  })
})
