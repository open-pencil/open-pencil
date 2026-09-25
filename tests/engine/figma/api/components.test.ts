import { describe, expect, test } from 'bun:test'

import { hasInstanceOverride } from '@open-pencil/scene-graph'

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
})

describe('instance child edits record overrides', () => {
  test('renaming and resizing an instance child survives component sync and export', () => {
    const api = createAPI()
    const component = api.createComponent()
    const child = api.createRectangle()
    child.resize(24, 24)
    component.appendChild(child)
    const instance = component.createInstance()
    const instanceChild = expectDefined(instance.children[0], 'instance child')
    instanceChild.name = 'renamed'
    instanceChild.resize(32, 32)

    expect(hasInstanceOverride(api.graph, instanceChild.id, 'name')).toBe(true)
    expect(hasInstanceOverride(api.graph, instanceChild.id, 'width')).toBe(true)
    child.resize(40, 40)
    child.name = 'component child'
    api.graph.syncInstances(component.id)
    expect(instanceChild.name).toBe('renamed')
    expect(instanceChild.width).toBe(32)
  })
})

describe('applied shared styles on instance children', () => {
  test('a text style applied inside an instance is an override and follows the component otherwise', () => {
    const api = createAPI()
    const graph = api.graph
    const page = graph.getPages()[0]
    const heading = graph.createNode('TEXT', page.id, {
      name: 'Heading',
      sharedStyleType: 'TEXT',
      text: 'Ag'
    })
    const body = graph.createNode('TEXT', page.id, {
      name: 'Body',
      sharedStyleType: 'TEXT',
      text: 'Ag'
    })
    const component = graph.createNode('COMPONENT', page.id, { name: 'Card' })
    const title = graph.createNode('TEXT', component.id, { name: 'title', text: 'Title' })
    const first = graph.createInstance(component.id, page.id)
    const second = graph.createInstance(component.id, page.id)
    const firstTitle = expectDefined(graph.getChildren(first.id)[0], 'first title')
    api.wrapNode(firstTitle.id).textStyleId = heading.id
    expect(hasInstanceOverride(graph, firstTitle.id, 'textStyleId')).toBe(true)

    graph.updateNode(title.id, { textStyleId: body.id })
    graph.syncInstances(component.id)
    expect(graph.getNode(firstTitle.id)?.textStyleId).toBe(heading.id)
    expect(graph.getChildren(second.id)[0]?.textStyleId).toBe(body.id)
  })
})
