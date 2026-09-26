import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#tests/helpers/assert'

import { createAPI } from './helpers'

describe('components', () => {
  test('exposes component property accessors and applies instance properties', () => {
    const api = createAPI()
    const component = api.createComponent()
    component.name = 'Card'
    component.appendChild(Object.assign(api.createText(), { name: 'Label', characters: 'Default' }))
    const propertyName = component.addComponentProperty('Label', 'TEXT', 'Default')
    const instance = component.createInstance()

    expect(component.componentPropertyDefinitions[propertyName]?.defaultValue).toBe('Default')
    expect(instance.componentProperties[propertyName]?.value).toBe('Default')
    instance.setProperties({ [propertyName]: 'Updated' })
    expect(instance.componentProperties[propertyName]?.value).toBe('Updated')
  })
  test('supports boolean properties, references, exposure, and CRUD', () => {
    const api = createAPI()
    const component = api.createComponent()
    const label = api.createText()
    label.name = 'Label'
    component.appendChild(label)
    const badge = api.createFrame()
    badge.name = 'Badge'
    component.appendChild(badge)

    const textName = component.addComponentProperty('Label', 'TEXT', 'Default')
    const visibleName = component.addComponentProperty('Visible', 'BOOLEAN', true)
    label.componentPropertyReferences = { characters: textName }
    badge.componentPropertyReferences = { visible: visibleName }
    const instance = component.createInstance()

    expect(component.componentPropertyReferences).toEqual({})
    expect(instance.componentProperties[visibleName]?.value).toBe(true)
    expect(badge.componentPropertyReferences).toEqual({ visible: visibleName })
    instance.setProperties({ [visibleName]: false })
    expect(instance.componentProperties[visibleName]?.value).toBe(false)

    const nested = api.createComponent()
    const slot = nested.createInstance()
    slot.componentPropertyReferences = { mainComponent: textName }
    expect(slot.isExposedInstance).toBe(true)
    slot.isExposedInstance = false
    expect(slot.isExposedInstance).toBe(false)

    const editedName = component.editComponentProperty(visibleName, { name: 'Shown' })
    expect(editedName).toContain('Shown#')
    component.deleteComponentProperty(editedName)
    expect(component.componentPropertyDefinitions[editedName]).toBeUndefined()
  })
  test('createInstance from component', () => {
    const api = createAPI()
    const comp = api.createComponent()
    comp.name = 'Button'
    comp.resize(200, 40)
    const instance = comp.createInstance()
    expect(instance.type).toBe('INSTANCE')
    expect(expectDefined(instance.mainComponent, 'instance main component').id).toBe(comp.id)
  })

  test('async lookups resolve like their synchronous forms', async () => {
    const api = createAPI()
    const component = api.createComponent()
    const instance = component.createInstance()

    expect((await api.getNodeByIdAsync(instance.id))?.id).toBe(instance.id)
    expect(await api.getNodeByIdAsync('0:404')).toBeNull()
    expect((await instance.getMainComponentAsync())?.id).toBe(component.id)
    expect(await component.getMainComponentAsync()).toBeNull()
  })
})
