import { describe, expect, test } from 'bun:test'

import { getNodeOrThrow } from '#tests/helpers/assert'

import { createAPI } from './helpers'

describe('layout sizing', () => {
  test('child in horizontal parent: h=primary, v=counter', () => {
    const api = createAPI()
    const parent = api.createFrame()
    parent.layoutMode = 'HORIZONTAL'
    const child = api.createFrame()
    parent.appendChild(child)
    child.layoutSizingHorizontal = 'FILL'
    child.layoutSizingVertical = 'HUG'
    expect(child.layoutSizingHorizontal).toBe('FILL')
    expect(child.layoutSizingVertical).toBe('HUG')
  })

  test('child in vertical parent: h=counter, v=primary', () => {
    const api = createAPI()
    const parent = api.createFrame()
    parent.layoutMode = 'VERTICAL'
    const child = api.createFrame()
    parent.appendChild(child)
    child.layoutSizingHorizontal = 'FILL'
    child.layoutSizingVertical = 'HUG'
    expect(child.layoutSizingHorizontal).toBe('FILL')
    expect(child.layoutSizingVertical).toBe('HUG')
  })

  test('auto-layout frame that is also a child of auto-layout', () => {
    const api = createAPI()
    const outer = api.createFrame()
    outer.layoutMode = 'HORIZONTAL'
    const inner = api.createFrame()
    inner.layoutMode = 'VERTICAL'
    outer.appendChild(inner)
    inner.layoutSizingHorizontal = 'FILL'
    expect(inner.layoutSizingHorizontal).toBe('FILL')
    expect(inner.layoutMode).toBe('VERTICAL')
  })

  test('HORIZONTAL child in VERTICAL parent: sizing maps to correct raw axis', () => {
    const api = createAPI()
    const parent = api.createFrame()
    parent.layoutMode = 'VERTICAL'
    parent.resize(375, 812)
    const child = api.createFrame()
    child.layoutMode = 'HORIZONTAL'
    parent.appendChild(child)
    child.layoutSizingVertical = 'FIXED'
    child.resize(375, 44)
    expect(child.layoutSizingVertical).toBe('FIXED')
    const raw = getNodeOrThrow(api.graph, child.id)
    expect(raw.counterAxisSizing).toBe('FIXED')
  })

  test('VERTICAL child in HORIZONTAL parent: sizing maps to correct raw axis', () => {
    const api = createAPI()
    const parent = api.createFrame()
    parent.layoutMode = 'HORIZONTAL'
    parent.resize(800, 600)
    const child = api.createFrame()
    child.layoutMode = 'VERTICAL'
    parent.appendChild(child)
    child.layoutSizingHorizontal = 'FIXED'
    child.resize(200, 600)
    expect(child.layoutSizingHorizontal).toBe('FIXED')
    const raw = getNodeOrThrow(api.graph, child.id)
    expect(raw.counterAxisSizing).toBe('FIXED')
  })
})
