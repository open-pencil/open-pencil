import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#tests/helpers/assert'

import { createAPI } from './helpers'

describe('node creation', () => {
  test('createFrame', () => {
    const api = createAPI()
    const frame = api.createFrame()
    expect(frame.type).toBe('FRAME')
    expect(expectDefined(frame.parent, 'frame parent').id).toBe(api.currentPage.id)
  })

  test('createRectangle', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    expect(rect.type).toBe('RECTANGLE')
  })

  test('createEllipse', () => {
    const api = createAPI()
    expect(api.createEllipse().type).toBe('ELLIPSE')
  })

  test('createText', () => {
    const api = createAPI()
    expect(api.createText().type).toBe('TEXT')
  })

  test('createLine', () => {
    const api = createAPI()
    expect(api.createLine().type).toBe('LINE')
  })

  test('createPolygon', () => {
    const api = createAPI()
    expect(api.createPolygon().type).toBe('POLYGON')
  })

  test('createStar', () => {
    const api = createAPI()
    expect(api.createStar().type).toBe('STAR')
  })

  test('createVector', () => {
    const api = createAPI()
    expect(api.createVector().type).toBe('VECTOR')
  })

  test('createComponent', () => {
    const api = createAPI()
    expect(api.createComponent().type).toBe('COMPONENT')
  })

  test('createSection', () => {
    const api = createAPI()
    expect(api.createSection().type).toBe('SECTION')
  })

  test('created node is child of current page', () => {
    const api = createAPI()
    const frame = api.createFrame()
    expect(api.currentPage.children.some((c) => c.id === frame.id)).toBe(true)
  })
})
