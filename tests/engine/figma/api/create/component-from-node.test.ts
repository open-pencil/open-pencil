import { describe, expect, test } from 'bun:test'

import { computeAllLayouts } from '@open-pencil/core'

import { createAPI } from '../helpers'

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
