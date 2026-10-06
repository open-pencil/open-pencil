import { describe, expect, test } from 'bun:test'

import { hasInstanceOverride } from '@open-pencil/scene-graph'

import { expectDefined } from '#tests/helpers/assert'

import { asTextNode, createAPI } from './helpers'

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

  test('detachInstance turns an instance into a frame with its content', () => {
    const api = createAPI()
    const component = api.createComponent()
    component.resize(80, 40)
    component.appendChild(Object.assign(api.createText(), { name: 'Label', characters: 'Default' }))
    const instance = component.createInstance()
    instance.x = 200

    const detached = instance.detachInstance()

    expect(detached.id).toBe(instance.id)
    expect(detached.type).toBe('FRAME')
    expect(detached.mainComponent).toBeNull()
    expect([detached.x, detached.width, detached.height]).toEqual([200, 80, 40])
    expect(detached.children.map((child) => child.name)).toEqual(['Label'])
    expect(api.getNodeById(component.id)?.type).toBe('COMPONENT')
  })

  test('detachInstance rejects nodes that are not instances', () => {
    const api = createAPI()
    expect(() => api.createFrame().detachInstance()).toThrow(
      'detachInstance() can only be called on instances'
    )
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

  test('swapComponent points an instance at another component', () => {
    const api = createAPI()
    const primary = api.createComponent()
    primary.name = 'Primary'
    primary.appendChild(Object.assign(api.createText(), { name: 'Label', characters: 'Primary' }))
    const secondary = api.createComponent()
    secondary.name = 'Secondary'
    secondary.appendChild(
      Object.assign(api.createText(), { name: 'Icon', characters: 'Secondary' })
    )
    const instance = primary.createInstance()

    instance.swapComponent(secondary)

    expect(expectDefined(instance.mainComponent, 'swapped main component').id).toBe(secondary.id)
    expect(instance.name).toBe('Secondary')
    expect(instance.children.map((child) => child.name)).toEqual(['Icon'])
  })

  test('swapComponent rejects non-instances and non-components', () => {
    const api = createAPI()
    const component = api.createComponent()
    const instance = component.createInstance()
    expect(() => api.createFrame().swapComponent(component)).toThrow(
      'swapComponent() can only be called on instances'
    )
    expect(() => instance.swapComponent(api.createFrame())).toThrow(
      'swapComponent() needs a component'
    )
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
    const first = expectDefined(graph.createInstance(component.id, page.id), 'first instance')
    const second = expectDefined(graph.createInstance(component.id, page.id), 'second instance')
    const firstTitle = expectDefined(graph.getChildren(first.id)[0], 'first title')
    asTextNode(api.wrapNode(firstTitle.id)).textStyleId = heading.id
    expect(hasInstanceOverride(graph, firstTitle.id, 'textStyleId')).toBe(true)

    graph.updateNode(title.id, { textStyleId: body.id })
    graph.syncInstances(component.id)
    expect(graph.getNode(firstTitle.id)?.textStyleId).toBe(heading.id)
    expect(graph.getChildren(second.id)[0]?.textStyleId).toBe(body.id)
  })
})
