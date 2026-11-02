import { describe, expect, test } from 'bun:test'

import { sectionStatusPill } from '#core/canvas/labels/status'

const title = { x: 0, y: -30, width: 80, height: 24 }
const name = (width: number) => ({ width, height: 11 })

describe("a section's status pill", () => {
  test('shows the whole name where it fits', () => {
    const pill = sectionStatusPill(title, 400, name(70))
    expect(pill?.compact).toBe(false)
    expect(pill?.maxTextWidth).toBeGreaterThan(70)
    expect(pill?.bounds.x).toBeGreaterThan(title.width)
  })

  test('cuts the name short as the title is, before dropping it', () => {
    const widest = sectionStatusPill(title, 140)
    expect(widest?.compact).toBe(false)
    expect(widest?.maxTextWidth).toBeLessThan(70)
    const pill = sectionStatusPill(title, 140, name(widest?.maxTextWidth ?? 0))
    expect((pill?.bounds.x ?? 0) + (pill?.bounds.width ?? 0)).toBeLessThanOrEqual(140)
  })

  test('keeps only the dot with no room for a letter', () => {
    const pill = sectionStatusPill(title, 110)
    expect(pill?.compact).toBe(true)
    expect((pill?.bounds.x ?? 0) + (pill?.bounds.width ?? 0)).toBeLessThanOrEqual(110)
  })

  test('is left out when not even the dot fits', () => {
    expect(sectionStatusPill(title, 90)).toBeNull()
  })
})
