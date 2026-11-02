import { describe, expect, test } from 'bun:test'

import { expectFills } from '#core-tests/helpers/assert'
import { createAPI, createStackHost } from '#core-tests/helpers/figma-api'

import type { FigmaNodeProxy } from '@open-pencil/core/figma-api'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { OpenPencilAPI } from '@open-pencil/core/openpencil-api'

describe('createComponentFromNode', () => {
  test('converts frame to component', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.name = 'MyButton'
    frame.resize(200, 50)
    const child = api.createRectangle()
    child.name = 'Background'
    frame.appendChild(child)
    const frameId = frame.id

    const comp = api.createComponentFromNode(frame)
    expect(comp.type).toBe('COMPONENT')
    expect(comp.name).toBe('MyButton')
    expect(comp.width).toBe(200)
    expect(comp.height).toBe(50)
    expect(comp.children.length).toBe(1)
    expect(comp.children[0].name).toBe('Background')
    expect(api.getNodeById(frameId)).toBeNull()
  })

  test('preserves root variable bindings and explicit modes', () => {
    const api = createAPI()
    const collection = api.variables.createVariableCollection('Radii')
    const variable = api.variables.createVariable('radius/md', collection, 'FLOAT')
    variable.setValueForMode(collection.defaultModeId, 8)

    const frame = api.createFrame()
    frame.name = 'Card'
    frame.resize(200, 50)
    frame.cornerRadius = 8
    new OpenPencilAPI(api).bindVariable(frame, 'cornerRadius', variable)
    api.graph.updateNode(frame.id, {
      variableModes: { [collection.id]: collection.defaultModeId }
    })

    const comp = api.createComponentFromNode(frame)
    const raw = api.graph.getNode(comp.id)

    expect(raw?.boundVariables.cornerRadius).toBe(variable.id)
    expect(raw?.variableModes).toEqual({ [collection.id]: collection.defaultModeId })
  })

  test('preserves auto-layout HUG sizing when padding changes after conversion', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.layoutMode = 'HORIZONTAL'
    frame.primaryAxisSizingMode = 'AUTO'
    frame.counterAxisSizingMode = 'AUTO'
    const child = api.createRectangle()
    child.resize(40, 20)
    frame.appendChild(child)
    computeAllLayouts(api.graph, frame.id)

    const comp = api.createComponentFromNode(frame)
    const initialWidth = comp.width
    const initialHeight = comp.height
    comp.paddingLeft = 20
    comp.paddingRight = 20
    comp.paddingTop = 10
    comp.paddingBottom = 10
    computeAllLayouts(api.graph, comp.id)

    expect(comp.width).toBe(initialWidth + 40)
    expect(comp.height).toBe(initialHeight + 20)
  })
  test('preserves auto-layout HUG sizing mode', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.layoutMode = 'HORIZONTAL'
    frame.primaryAxisSizingMode = 'AUTO'
    frame.counterAxisSizingMode = 'AUTO'

    const comp = api.createComponentFromNode(frame)
    const raw = api.graph.getNode(comp.id)

    expect(raw?.primaryAxisSizing).toBe('HUG')
    expect(raw?.counterAxisSizing).toBe('HUG')
  })
})

// Recorded with the same script in Figma desktop 126.
describe('createComponentFromNode like Figma', () => {
  test('a component from a layer wraps it in a white component named after it', () => {
    const { figma, rect, order } = createStackHost()
    rect('a', 0)
    const r = rect('r', 100)
    rect('z', 300)
    const component = figma.createComponentFromNode(r)
    expect(component.type).toBe('COMPONENT')
    expect(component.name).toBe('r')
    expect([component.x, component.y, component.width, component.height]).toEqual([100, 0, 50, 50])
    expect(expectFills(component.fills)[0]).toMatchObject({ color: { r: 1, g: 1, b: 1 } })
    expect(order()).toEqual(['a', 'r', 'z'])
    expect(r.removed).toBe(false)
    expect(component.children[0]?.id).toBe(r.id)
    expect([r.x, r.y]).toEqual([0, 0])
  })

  test('a component from a frame keeps its place, look, and children', () => {
    const { figma, host, rect, order } = createStackHost()
    rect('a', 0)
    const frame = figma.createFrame()
    frame.name = 'f'
    frame.x = 100
    frame.cornerRadius = 4
    host.appendChild(frame)
    const inner = figma.createEllipse()
    frame.appendChild(inner)
    rect('z', 300)
    const component = figma.createComponentFromNode(frame)
    expect(order()).toEqual(['a', 'f', 'z'])
    expect(component.cornerRadius).toBe(4)
    expect(component.clipsContent).toBe(true)
    expect(component.children.map((child: FigmaNodeProxy) => child.id)).toEqual([inner.id])
    expect(frame.removed).toBe(true)
  })

  test('a component from a group takes its place and children, with no fill', () => {
    const { figma, host, rect, order } = createStackHost()
    rect('a', 0)
    const b = rect('b', 100)
    const c = rect('c', 200)
    rect('d', 300)
    const group = figma.group([b, c], host, 1)
    group.name = 'grp'
    const component = figma.createComponentFromNode(group)
    expect(order()).toEqual(['a', 'grp', 'd'])
    expect(component.fills).toEqual([])
    expect(component.children.map((child: FigmaNodeProxy) => child.id)).toEqual([b.id, c.id])
    expect([b.x, c.x]).toEqual([0, 100])
    expect(group.removed).toBe(true)
  })
})
