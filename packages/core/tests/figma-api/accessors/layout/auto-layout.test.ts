import { describe, expect, test } from 'bun:test'

import { createAPI } from '#core-tests/helpers/figma-api'

describe('auto-layout', () => {
  test('layoutMode', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.layoutMode = 'VERTICAL'
    expect(frame.layoutMode).toBe('VERTICAL')
  })

  test('itemSpacing', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.layoutMode = 'VERTICAL'
    frame.itemSpacing = 12
    expect(frame.itemSpacing).toBe(12)
  })

  test('padding', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.paddingTop = 16
    frame.paddingRight = 24
    frame.paddingBottom = 16
    frame.paddingLeft = 24
    expect(frame.paddingTop).toBe(16)
    expect(frame.paddingRight).toBe(24)
  })

  test('alignment', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.layoutMode = 'HORIZONTAL'
    frame.primaryAxisAlignItems = 'SPACE_BETWEEN'
    frame.counterAxisAlignItems = 'CENTER'
    expect(frame.primaryAxisAlignItems).toBe('SPACE_BETWEEN')
    expect(frame.counterAxisAlignItems).toBe('CENTER')
  })

  test('layoutWrap', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.layoutWrap = 'WRAP'
    expect(frame.layoutWrap).toBe('WRAP')
  })
})

describe('auto-layout extras', () => {
  test('primaryAxisSizingMode maps FIXED/AUTO, and a new frame hugs along its main axis', () => {
    // As in Figma desktop 126, a new frame's main axis hugs, which auto layout keeps.
    const api = createAPI()
    const frame = api.createFrame()
    frame.layoutMode = 'VERTICAL'
    expect(frame.primaryAxisSizingMode).toBe('AUTO')
    expect(frame.layoutSizingVertical).toBe('HUG')
    frame.primaryAxisSizingMode = 'FIXED'
    expect(frame.primaryAxisSizingMode).toBe('FIXED')
    expect(frame.layoutSizingVertical).toBe('FIXED')
  })

  test('a resize fixes hugging axes, and a grid starts fixed on both', () => {
    // Repeats a Figma desktop 126 script: the frame hugs its layer until it is resized.
    const api = createAPI()
    const frame = api.createFrame()
    const box = api.createRectangle()
    box.resize(40, 20)
    frame.appendChild(box)
    frame.layoutMode = 'VERTICAL'
    expect([frame.primaryAxisSizingMode, frame.counterAxisSizingMode, frame.height]).toEqual([
      'AUTO',
      'FIXED',
      20
    ])
    frame.resize(200, 120)
    expect([frame.primaryAxisSizingMode, frame.counterAxisSizingMode, frame.height]).toEqual([
      'FIXED',
      'FIXED',
      120
    ])
    const grid = api.createFrame()
    grid.layoutMode = 'GRID'
    expect([grid.primaryAxisSizingMode, grid.counterAxisSizingMode]).toEqual(['FIXED', 'FIXED'])
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
