import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'

import { canOutlineStroke } from '#core/canvas/outline-stroke'

const solid = {
  type: 'SOLID',
  color: { r: 1, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true
} as const

function rect(props: object) {
  const editor = createEditor()
  return editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
    width: 40,
    height: 40,
    fills: [],
    strokes: [],
    ...props
  })
}

describe('canOutlineStroke', () => {
  // Figma desktop 126 turns a fill-only layer into a vector of its fill.
  test('a layer with a visible stroke or fill can be outlined, one without cannot', () => {
    expect(canOutlineStroke(rect({ fills: [solid] }))).toBe(true)
    expect(canOutlineStroke(rect({ strokes: [{ ...solid, weight: 2, align: 'CENTER' }] }))).toBe(
      true
    )
    expect(canOutlineStroke(rect({}))).toBe(false)
    expect(canOutlineStroke(rect({ fills: [{ ...solid, visible: false }] }))).toBe(false)
  })
})
