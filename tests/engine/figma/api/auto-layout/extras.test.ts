import { describe, expect, test } from 'bun:test'

import { createAPI } from '../helpers'

describe('auto-layout extras', () => {
  test('primaryAxisSizingMode maps FIXED/AUTO', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.layoutMode = 'VERTICAL'
    expect(frame.primaryAxisSizingMode).toBe('FIXED')
    frame.primaryAxisSizingMode = 'AUTO'
    expect(frame.primaryAxisSizingMode).toBe('AUTO')
    expect(frame.layoutSizingVertical).toBe('HUG')
  })

  test('counterAxisSizingMode maps FIXED/AUTO', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.layoutMode = 'VERTICAL'
    frame.counterAxisSizingMode = 'AUTO'
    expect(frame.counterAxisSizingMode).toBe('AUTO')
    expect(frame.layoutSizingHorizontal).toBe('HUG')
  })

  test('counterAxisAlignContent', () => {
    const api = createAPI()
    const frame = api.createFrame()
    expect(frame.counterAxisAlignContent).toBe('AUTO')
    frame.counterAxisAlignContent = 'SPACE_BETWEEN'
    expect(frame.counterAxisAlignContent).toBe('SPACE_BETWEEN')
  })

  test('itemReverseZIndex', () => {
    const api = createAPI()
    const frame = api.createFrame()
    expect(frame.itemReverseZIndex).toBe(false)
    frame.itemReverseZIndex = true
    expect(frame.itemReverseZIndex).toBe(true)
  })

  test('strokesIncludedInLayout', () => {
    const api = createAPI()
    const frame = api.createFrame()
    expect(frame.strokesIncludedInLayout).toBe(false)
    frame.strokesIncludedInLayout = true
    expect(frame.strokesIncludedInLayout).toBe(true)
  })

  test('layoutAlign maps to layoutAlignSelf', () => {
    const api = createAPI()
    const parent = api.createFrame()
    parent.layoutMode = 'VERTICAL'
    const child = api.createFrame()
    parent.appendChild(child)
    expect(child.layoutAlign).toBe('INHERIT')
    child.layoutAlign = 'STRETCH'
    expect(child.layoutAlign).toBe('STRETCH')
  })
})
