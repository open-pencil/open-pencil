import { describe, expect, test } from 'bun:test'

import { pressesTinyLayer, transformZoneAt } from '@lawha/core/geometry'

/** The zone at a point given in screen pixels from a layer's top-left corner, as a short name. */
function zone(width: number, height: number, x: number, y: number, zoom = 1) {
  const found = transformZoneAt({ x: x / zoom, y: y / zoom }, { x: 0, y: 0, width, height }, zoom)
  if (!found) return null
  return found.kind === 'resize' ? found.handle : `rotate ${found.corner}`
}

// Every case is a drag Figma desktop 126 answered on a frame at a known screen point: a resize
// from a handle, a rotation, or neither (a move inside the layer, a marquee outside it).
describe('Figma transform zones', () => {
  test('a corner resizes within 7.5 px of it, and along its edges near it', () => {
    const at = (dx: number, dy: number) => zone(240, 160, 240 + dx, 160 + dy)
    expect(at(5, 5)).toBe('se')
    expect(at(5.3, 5.3)).toBe('se')
    expect(at(7.4, 0)).toBe('se')
    expect(at(0, 7)).toBe('se')
    expect(at(7, -3)).toBe('se')
    expect(at(-3, 7)).toBe('se')
    expect(at(-1, 7)).toBe('se')
    expect(at(5.5, 5.5)).toBe('rotate se')
    expect(at(7.6, 0)).toBe('rotate se')
  })

  test('outside the layer near a corner rotates, up to 16 px from it', () => {
    const at = (dx: number, dy: number) => zone(240, 160, 240 + dx, 160 + dy)
    expect(at(10, 10)).toBe('rotate se')
    expect(at(12, -3)).toBe('rotate se')
    expect(at(12, -10)).toBe('rotate se')
    expect(at(-6, 12)).toBe('rotate se')
    expect(at(12, 12)).toBeNull()
    expect(at(18, 0)).toBeNull()
  })

  test('an edge resizes 7.5 px outside it and up to a tenth of the side inside it', () => {
    expect(zone(240, 160, 246, 120)).toBe('e')
    expect(zone(240, 160, 234, 120)).toBe('e')
    expect(zone(240, 160, 248, 120)).toBeNull()
    expect(zone(240, 160, 232, 120)).toBeNull()
    expect(zone(48, 200, 48 - 4, 100)).toBe('e')
    expect(zone(48, 200, 48 - 5, 100)).toBeNull()
    expect(zone(24, 200, 24 - 2, 100)).toBe('e')
    expect(zone(24, 200, 24 - 3, 100)).toBeNull()
    expect(zone(60, 200, 60 - 5, 100)).toBe('e')
    expect(zone(60, 200, 60 - 6, 100)).toBeNull()
    expect(zone(80, 200, 80 - 7.5, 100)).toBe('e')
    expect(zone(80, 200, 80 - 8, 100)).toBeNull()
    for (const width of [6, 16, 48]) {
      expect(zone(width, 200, width + 7, 100)).toBe('e')
      expect(zone(width, 200, width + 8, 100)).toBeNull()
    }
  })

  test('a side under 24 px keeps every band outside the layer', () => {
    expect(zone(22, 200, 22, 100)).toBe('e')
    expect(zone(22, 200, 21, 100)).toBeNull()
    expect(zone(120, 6, 117, 3)).toBeNull()
    expect(zone(120, 6, 60, 9)).toBe('s')
    expect(zone(6, 120, 3, 123)).toBe('s')
  })

  test("a small layer's left and top edges are inside it, its right and bottom ones beyond it", () => {
    expect(zone(6, 200, 0, 100)).toBeNull()
    expect(zone(6, 200, 6, 100)).toBe('e')
    expect(zone(6, 200, -1, 100)).toBe('w')
    expect(zone(120, 6, 60, 0)).toBeNull()
    expect(zone(120, 6, 60, 6)).toBe('s')
  })

  test('a small layer resizes from a corner only beyond both its edges', () => {
    expect(zone(10, 10, 13, 13)).toBe('se')
    expect(zone(10, 10, 15, 15)).toBe('se')
    expect(zone(10, 10, 10, 10)).toBe('e')
    expect(zone(10, 10, 17, 10)).toBe('e')
    expect(zone(10, 10, 10, 17)).toBe('s')
    expect(zone(10, 10, 13, 7)).toBe('e')
    expect(zone(10, 10, 9, 9)).toBeNull()
    expect(zone(10, 10, 20, 20)).toBe('rotate se')
    expect(zone(10, 10, 22, 7)).toBe('rotate se')
    expect(zone(23, 23, 23, 23)).toBe('e')
    expect(zone(120, 16, 120, 16)).toBe('e')
    expect(zone(24, 24, 27, 21)).toBe('se')
    expect(zone(24, 24, 19, 19)).toBe('se')
    expect(zone(24, 24, 18, 18)).toBeNull()
  })

  test('a layer with both sides under 10 px takes no resize or rotation', () => {
    for (const [width, height] of [
      [9, 9],
      [8, 6],
      [6, 8]
    ]) {
      expect(zone(width, height, width + 3, height / 2)).toBeNull()
      expect(zone(width, height, width + 10, height + 10)).toBeNull()
    }
    expect(zone(6, 10, 9, 5)).toBe('e')
    expect(zone(10, 6, 14, 10)).toBe('se')
  })

  test('the zones keep their screen size at any zoom', () => {
    const at = (dx: number, dy: number) => zone(240, 160, 480 + dx, 320 + dy, 2)
    expect(at(7.4, 0)).toBe('se')
    expect(at(7.6, 0)).toBe('rotate se')
    expect(at(6, -40)).toBe('e')
    expect(at(-6, -40)).toBe('e')
    expect(at(8, -40)).toBeNull()
    expect(at(-8, -40)).toBeNull()
    expect(at(12, -10)).toBe('rotate se')
    expect(at(12, 12)).toBeNull()
  })

  test('a selected layer too small for handles takes presses across a 16 px span', () => {
    const presses = (width: number, height: number, x: number, y: number) =>
      pressesTinyLayer({ x, y }, { x: 0, y: 0, width, height }, 1)
    expect(presses(6, 6, 11, 3)).toBe(true)
    expect(presses(6, 6, 12, 3)).toBe(false)
    expect(presses(9, 9, 12, 4.5)).toBe(true)
    expect(presses(9, 9, 13, 4.5)).toBe(false)
    expect(presses(2, 2, 8, 1)).toBe(true)
    expect(presses(2, 2, 6, 6)).toBe(false)
    expect(presses(6, 6, 10, 10)).toBe(false)
    expect(presses(6, 6, 3, -5)).toBe(true)
    expect(presses(6, 30, 11, 15)).toBe(false)
  })
})
