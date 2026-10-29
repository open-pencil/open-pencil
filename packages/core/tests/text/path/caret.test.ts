import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import type { DerivedTextGlyph } from '@open-pencil/scene-graph'

import { pathTextCaret, pathTextIndexAt, pathTextSelectionQuads } from '#core/text/path'

const metrics = { ascent: 0.9, descent: 0.2 }

/** Glyphs 10 px wide at 10 px, one per character, on a baseline from `origin` along `rotation`. */
function run(count: number, rotation = 0, origin = { x: 0, y: 50 }): DerivedTextGlyph[] {
  const along = { x: Math.cos(rotation), y: -Math.sin(rotation) }
  return Array.from({ length: count }, (_, index) => ({
    commandsBlob: new Uint8Array(4),
    x: origin.x + along.x * 10 * index,
    y: origin.y + along.y * 10 * index,
    fontSize: 10,
    rotation,
    advance: 10
  }))
}

describe('the caret on text on a path', () => {
  test('stands square to the baseline before its character, from the descent to the ascent', () => {
    const caret = expectDefined(pathTextCaret(run(3), 3, 1, metrics))
    expect(caret.from.x).toBeCloseTo(10)
    expect(caret.from.y).toBeCloseTo(52)
    expect(caret.to.x).toBeCloseTo(10)
    expect(caret.to.y).toBeCloseTo(41)
  })

  test('stands after the last glyph at the end of the text', () => {
    const caret = expectDefined(pathTextCaret(run(3), 3, 3, metrics))
    expect(caret.from.x).toBeCloseTo(30)
  })

  test('turns with a glyph running down the path', () => {
    // Text running down: the baseline points down and the ascender to the right.
    const caret = expectDefined(pathTextCaret(run(2, -Math.PI / 2), 2, 1, metrics))
    expect(caret.from.x).toBeCloseTo(-2)
    expect(caret.from.y).toBeCloseTo(60)
    expect(caret.to.x).toBeCloseTo(9)
    expect(caret.to.y).toBeCloseTo(60)
  })

  test('stays after the last drawn glyph for characters cut off the path', () => {
    const caret = expectDefined(pathTextCaret(run(3), 10, 7, metrics))
    expect(caret.from.x).toBeCloseTo(30)
  })
})

describe('the character a point on text on a path hits', () => {
  test('is the boundary on the side of the character the point is on', () => {
    expect(pathTextIndexAt(run(3), 3, { x: 14, y: 45 }, metrics)).toBe(1)
    expect(pathTextIndexAt(run(3), 3, { x: 16, y: 45 }, metrics)).toBe(2)
  })

  test('is the nearest glyph’s for a point off the lettering', () => {
    expect(pathTextIndexAt(run(3), 3, { x: 80, y: 50 }, metrics)).toBe(3)
    expect(pathTextIndexAt(run(3), 3, { x: -20, y: 50 }, metrics)).toBe(0)
    expect(pathTextIndexAt(run(3), 3, { x: 22, y: 10 }, metrics)).toBe(2)
  })

  test('follows a glyph turned with the path', () => {
    // Running down from (0, 50): the second glyph spans y 60…70, its ascender to the right.
    expect(pathTextIndexAt(run(3, -Math.PI / 2), 3, { x: 4, y: 67 }, metrics)).toBe(2)
    expect(pathTextIndexAt(run(3, -Math.PI / 2), 3, { x: 4, y: 63 }, metrics)).toBe(1)
  })

  test('counts the characters a glyph draws, skipping those without one', () => {
    // "A B": the space has no glyph, so the first glyph runs to the second's character.
    const glyphs = run(2).map((glyph, index) => ({ ...glyph, firstCharacter: index * 2 }))
    expect(pathTextIndexAt(glyphs, 3, { x: 2, y: 45 }, metrics)).toBe(0)
    expect(pathTextIndexAt(glyphs, 3, { x: 7, y: 45 }, metrics)).toBe(1)
    expect(pathTextIndexAt(glyphs, 3, { x: 12, y: 45 }, metrics)).toBe(2)
  })
})

test('a selection on text on a path covers each glyph it touches, turned with it', () => {
  const quads = pathTextSelectionQuads(run(3), 3, 1, 3, metrics)
  expect(quads).toHaveLength(2)
  const [first] = quads
  expect(first.map(({ x, y }) => [Math.round(x), Math.round(y)])).toEqual([
    [10, 52],
    [20, 52],
    [20, 41],
    [10, 41]
  ])
  expect(pathTextSelectionQuads(run(3), 3, 1, 1, metrics)).toEqual([])
})
