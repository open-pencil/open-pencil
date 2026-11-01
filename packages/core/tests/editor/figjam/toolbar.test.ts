import { describe, expect, test } from 'bun:test'

import { figJamToolbarKind } from '@open-pencil/core'
import type { Fill, NodeType } from '@open-pencil/scene-graph'

const layer = (type: NodeType, fills: Fill[] = []) => ({ type, fills })
const image: Fill = {
  type: 'IMAGE',
  color: { r: 0, g: 0, b: 0, a: 1 },
  imageHash: 'hash',
  imageScaleMode: 'FILL',
  opacity: 1,
  visible: true
}

// Measured in FigJam on 2026-10-31: which toolbar each selection gets.
describe("FigJam's selection toolbars", () => {
  test('each kind of layer gets its own', () => {
    expect(figJamToolbarKind([layer('STICKY')])).toBe('sticky')
    expect(figJamToolbarKind([layer('SECTION')])).toBe('section')
    expect(figJamToolbarKind([layer('RECTANGLE'), layer('FRAME'), layer('LINE')])).toBe('layer')
    expect(figJamToolbarKind([layer('RECTANGLE', [image])])).toBe('image')
    expect(figJamToolbarKind([layer('RECTANGLE', [{ ...image, visible: false }])])).toBe('layer')
    expect(figJamToolbarKind([layer('SECTION', [image])])).toBe('section')
    expect(figJamToolbarKind([layer('TEXT', [image])])).toBe('text')
    expect(figJamToolbarKind([])).toBeNull()
  })

  test('text with sticky notes shares text menus, and any other mix only arranges', () => {
    expect(figJamToolbarKind([layer('STICKY'), layer('TEXT')])).toBe('text')
    expect(figJamToolbarKind([layer('STICKY'), layer('SHAPE_WITH_TEXT')])).toBe('mixed')
    expect(figJamToolbarKind([layer('SECTION'), layer('STICKY')])).toBe('mixed')
  })
})
