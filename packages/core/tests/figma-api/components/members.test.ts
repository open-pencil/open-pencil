import { describe, expect, test } from 'bun:test'

import { createAPI } from '#core-tests/helpers/figma-api'

// Measured with the same scripts in Figma's plugin API (Figma desktop 126).

describe('component and component set members', () => {
  test('a description, on components and sets alone', () => {
    const figma = createAPI()
    const component = figma.createComponent()
    expect(component.description).toBe('')
    component.description = 'Primary action'
    expect(component.description).toBe('Primary action')
    expect(figma.graph.getNode(component.id)?.symbolDescription).toBe('Primary action')
    expect(() => (component.description = 3 as never)).toThrow(
      'in set_description: Property "description" failed validation: Expected string, received number'
    )
    const set = figma.combineAsVariants([component], figma.currentPage)
    set.description = 'Buttons'
    expect(set.description).toBe('Buttons')
    expect('description' in figma.createFrame()).toBe(false)
  })

  test('a component’s instances', async () => {
    const figma = createAPI()
    const component = figma.createComponent()
    expect(component.instances).toEqual([])
    const first = component.createInstance()
    const second = component.createInstance()
    const ids = [first.id, second.id].sort()
    expect(component.instances.map((instance) => instance.id).sort()).toEqual(ids)
    expect((await component.getInstancesAsync()).map((instance) => instance.id).sort()).toEqual(ids)
  })

  test('a removed component’s instances reject', async () => {
    const component = createAPI().createComponent()
    component.remove()
    await expect(component.getInstancesAsync()).rejects.toThrow()
  })

  // The shadcn/ui community kit saves its sets' variant properties with neither values nor a
  // default.
  test('a set read from a file without its option lists gives its variants’ values', () => {
    const figma = createAPI()
    const small = figma.createComponent()
    small.name = 'size=s'
    const large = figma.createComponent()
    large.name = 'size=l'
    large.y = 200
    const set = figma.combineAsVariants([small, large], figma.currentPage)
    // Small stays the top-left, default variant while coming second in layer order.
    set.insertChild(0, large)
    const node = figma.graph.getNode(set.id)
    if (!node) throw new Error('Expected the set')
    figma.graph.updateNode(set.id, {
      componentPropertyDefinitions: node.componentPropertyDefinitions.map(
        ({ variantOptions: _options, ...definition }) => ({ ...definition, defaultValue: '' })
      )
    })
    expect(set.variantGroupProperties).toEqual({ size: { values: ['l', 's'] } })
    expect(set.componentPropertyDefinitions).toEqual({
      size: { type: 'VARIANT', defaultValue: 's', variantOptions: ['l', 's'] }
    })
  })

  test('a set’s default variant, the first in reading order, and its variant values', () => {
    const figma = createAPI()
    const variant = (name: string, x: number, y: number) => {
      const component = figma.createComponent()
      component.name = name
      component.resize(100, 100)
      component.x = x
      component.y = y
      return component
    }
    // Large's row touches the top one, so the row reads left to right from it.
    const set = figma.combineAsVariants(
      [variant('size=s', 200, 0), variant('size=l', 0, 100), variant('size=m', 100, 0)],
      figma.currentPage
    )
    expect(set.defaultVariant?.name).toBe('size=l')
    expect(set.variantGroupProperties).toEqual({ size: { values: ['s', 'l', 'm'] } })
  })
})
