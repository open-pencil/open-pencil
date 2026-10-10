import { describe, expect, test } from 'bun:test'

import { createAPI } from '../helpers'

// Expected values were observed by running the same scripts in live Figma on 2026-10-10.

describe('aspect ratio lock', () => {
  test('locking stores the current size and unlocking clears it', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    rect.resize(200, 100)
    expect(rect.targetAspectRatio).toBeNull()
    expect(rect.constrainProportions).toBe(false)

    rect.lockAspectRatio()
    expect(rect.targetAspectRatio).toEqual({ x: 200, y: 100 })
    expect(rect.constrainProportions).toBe(true)

    rect.unlockAspectRatio()
    expect(rect.targetAspectRatio).toBeNull()
    expect(rect.constrainProportions).toBe(false)
  })

  test('constrainProportions locks and unlocks', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    rect.resize(200, 100)
    rect.constrainProportions = true
    expect(rect.targetAspectRatio).toEqual({ x: 200, y: 100 })
    rect.constrainProportions = false
    expect(rect.targetAspectRatio).toBeNull()
  })

  test('resize ignores the lock and stores the new size', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    rect.resize(200, 100)
    rect.lockAspectRatio()
    rect.resize(400, 100)
    expect([rect.width, rect.height]).toEqual([400, 100])
    expect(rect.targetAspectRatio).toEqual({ x: 400, y: 100 })
    rect.resizeWithoutConstraints(300, 300)
    expect(rect.targetAspectRatio).toEqual({ x: 300, y: 300 })
  })

  test('rescale keeps the stored size', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    rect.resize(200, 100)
    rect.lockAspectRatio()
    rect.rescale(2)
    expect([rect.width, rect.height]).toEqual([400, 200])
    expect(rect.targetAspectRatio).toEqual({ x: 200, y: 100 })
  })

  test('a fill child keeps its ratio as its frame grows', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.layoutMode = 'HORIZONTAL'
    frame.resize(300, 300)
    frame.primaryAxisSizingMode = 'FIXED'
    frame.counterAxisSizingMode = 'FIXED'
    const child = api.createRectangle()
    child.resize(100, 50)
    frame.appendChild(child)
    child.lockAspectRatio()
    child.layoutSizingHorizontal = 'FILL'
    expect([child.width, child.height]).toEqual([300, 150])
    frame.resize(500, 300)
    expect([child.width, child.height]).toEqual([500, 250])
  })

  test('instances take the lock from their component and can unlock it', () => {
    const api = createAPI()
    const component = api.createComponent()
    component.resize(100, 50)
    component.lockAspectRatio()
    const instance = component.createInstance()
    expect(instance.targetAspectRatio).toEqual({ x: 100, y: 50 })
    instance.unlockAspectRatio()
    expect(instance.targetAspectRatio).toBeNull()
  })

  test('a layer inside an instance keeps its component lock', () => {
    const api = createAPI()
    const component = api.createComponent()
    component.resize(100, 100)
    component.appendChild(api.createRectangle())
    const instance = component.createInstance()
    const inner = instance.children[0]
    inner.lockAspectRatio()
    expect(inner.targetAspectRatio).toBeNull()
  })
})
