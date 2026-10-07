import { describe, expect, test } from 'bun:test'

import { getNodeOrThrow } from '#tests/helpers/assert'

import { asTextNode, createAPI } from '../helpers'

// Expected values were observed by running the same scripts in live Figma on 2026-10-06.

function fixedRow(api: ReturnType<typeof createAPI>, mode: 'HORIZONTAL' | 'VERTICAL') {
  const parent = api.createFrame()
  parent.layoutMode = mode
  parent.resize(300, 300)
  parent.primaryAxisSizingMode = 'FIXED'
  parent.counterAxisSizingMode = 'FIXED'
  return parent
}

function read(node: {
  layoutSizingHorizontal: string
  layoutSizingVertical: string
  layoutGrow: number
  layoutAlign: string
}) {
  return {
    h: node.layoutSizingHorizontal,
    v: node.layoutSizingVertical,
    grow: node.layoutGrow,
    align: node.layoutAlign
  }
}

describe('layout sizing', () => {
  test('fill along the parent axis grows, fill across it stretches', () => {
    const api = createAPI()
    const row = fixedRow(api, 'HORIZONTAL')
    const wide = api.createFrame()
    row.appendChild(wide)
    wide.layoutSizingHorizontal = 'FILL'
    const tall = api.createFrame()
    row.appendChild(tall)
    tall.layoutSizingVertical = 'FILL'

    expect(read(wide)).toEqual({ h: 'FILL', v: 'FIXED', grow: 1, align: 'INHERIT' })
    expect(read(tall)).toEqual({ h: 'FIXED', v: 'FILL', grow: 0, align: 'STRETCH' })
  })

  test('an auto-layout child fills through its parent and hugs through its own axes', () => {
    const api = createAPI()
    const column = fixedRow(api, 'VERTICAL')
    const inner = api.createFrame()
    inner.layoutMode = 'HORIZONTAL'
    column.appendChild(inner)
    inner.layoutSizingHorizontal = 'FILL'
    inner.layoutSizingVertical = 'HUG'

    expect(read(inner)).toEqual({ h: 'FILL', v: 'HUG', grow: 0, align: 'STRETCH' })
    expect(inner.primaryAxisSizingMode).toBe('FIXED')
    expect(inner.counterAxisSizingMode).toBe('AUTO')

    inner.layoutSizingVertical = 'FILL'
    expect(read(inner)).toEqual({ h: 'FILL', v: 'FILL', grow: 1, align: 'STRETCH' })
    expect(inner.counterAxisSizingMode).toBe('FIXED')
    expect(inner.width).toBe(300)
    expect(inner.height).toBe(300)
  })

  test('text hugs through textAutoResize', () => {
    const api = createAPI()
    const row = fixedRow(api, 'HORIZONTAL')
    const text = asTextNode(api.createText())
    // Figma's createText() starts at WIDTH_AND_HEIGHT; ours starts at NONE.
    text.textAutoResize = 'WIDTH_AND_HEIGHT'
    text.characters = 'Hello'
    row.appendChild(text)
    const state = () => ({ ...read(text), auto: text.textAutoResize })

    expect(state()).toEqual({
      h: 'HUG',
      v: 'HUG',
      grow: 0,
      align: 'INHERIT',
      auto: 'WIDTH_AND_HEIGHT'
    })
    text.layoutSizingHorizontal = 'FIXED'
    expect(state()).toMatchObject({ h: 'FIXED', v: 'HUG', auto: 'HEIGHT' })
    text.layoutSizingVertical = 'FIXED'
    expect(state()).toMatchObject({ h: 'FIXED', v: 'FIXED', auto: 'NONE' })
    text.layoutSizingVertical = 'HUG'
    expect(state()).toMatchObject({ h: 'FIXED', v: 'HUG', auto: 'HEIGHT' })
    text.layoutSizingHorizontal = 'HUG'
    expect(state()).toMatchObject({ h: 'HUG', v: 'HUG', auto: 'WIDTH_AND_HEIGHT' })
    text.layoutSizingHorizontal = 'FILL'
    expect(state()).toEqual({ h: 'FILL', v: 'HUG', grow: 1, align: 'INHERIT', auto: 'HEIGHT' })
    text.layoutSizingVertical = 'FILL'
    expect(state()).toEqual({ h: 'FILL', v: 'FILL', grow: 1, align: 'STRETCH', auto: 'NONE' })
    // Text cannot hug its width while its height fills, so the width becomes fixed.
    text.layoutSizingHorizontal = 'HUG'
    expect(state()).toEqual({ h: 'FIXED', v: 'FILL', grow: 0, align: 'STRETCH', auto: 'NONE' })
  })

  test('refuses sizing that Figma refuses', () => {
    const api = createAPI()
    const loose = api.createFrame()
    expect(() => (loose.layoutSizingHorizontal = 'FILL')).toThrow(
      'in set_layoutSizingHorizontal: node must be an auto-layout frame or a child of an auto-layout frame'
    )
    expect(read(loose)).toMatchObject({ h: 'FIXED', v: 'FIXED' })

    loose.layoutMode = 'VERTICAL'
    loose.layoutSizingVertical = 'HUG'
    expect(read(loose)).toMatchObject({ h: 'FIXED', v: 'HUG' })
    expect(loose.primaryAxisSizingMode).toBe('AUTO')

    const row = fixedRow(api, 'HORIZONTAL')
    const plain = api.createFrame()
    row.appendChild(plain)
    expect(() => (plain.layoutSizingVertical = 'HUG')).toThrow(
      'in set_layoutSizingVertical: HUG can only be set on auto-layout frames or text children of auto-layout frames'
    )
    const absolute = api.createFrame()
    row.appendChild(absolute)
    absolute.layoutPositioning = 'ABSOLUTE'
    expect(() => (absolute.layoutSizingHorizontal = 'FILL')).toThrow(
      'in set_layoutSizingHorizontal: FILL cannot be set on absolute positioned auto-layout children'
    )
    expect(read(absolute)).toMatchObject({ h: 'FIXED', v: 'FIXED' })
  })

  test('text outside auto-layout reports fixed sizing', () => {
    const api = createAPI()
    const text = asTextNode(api.createText())
    text.characters = 'Hello'
    expect(read(text)).toMatchObject({ h: 'FIXED', v: 'FIXED' })
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
