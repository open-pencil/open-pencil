import { describe, expect, test } from 'bun:test'

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
})
