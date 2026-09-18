import { expect, test } from 'bun:test'

import { encodePathCommandsBlob, type OutlineCommand } from '@open-pencil/fig/node-change'

const outline: OutlineCommand[] = [
  { type: 'M', x: 2, y: 4 },
  { type: 'L', x: 6, y: -8 },
  { type: 'C', x1: 2, y1: -4, x2: 6, y2: 8, x: 10, y: 12 },
  { type: 'Q', x1: 16, y1: 18, x: 22, y: 24 },
  { type: 'Z' }
]

test('preserves little-endian glyph bytes, scaling, Y inversion, and quadratic conversion', () => {
  const bytes = encodePathCommandsBlob(outline, 2)
  expect(Buffer.from(bytes).toString('hex')).toBe(
    '010000803f000000c0020000404000008040040000803f0000004000004040000080c00000a0400000c0c0040000e040000000c100001041000020c100003041000040c100'
  )
})

test('preserves missing-coordinate defaults and signed zero', () => {
  const bytes = encodePathCommandsBlob(
    [{ type: 'M' }, { type: 'C' }, { type: 'Q' }, { type: 'Z' }],
    2
  )
  expect(Buffer.from(bytes).toString('hex')).toBe(
    '010000000000000000040000000000000000000000000000000000000000000000000400000000000000800000000000000080000000000000008000'
  )
})

test('ignores unsupported commands without reserving bytes or changing the current point', () => {
  expect(encodePathCommandsBlob([])).toEqual(new Uint8Array())
  expect(encodePathCommandsBlob([{ type: 'unsupported' }])).toEqual(new Uint8Array())
  expect(
    encodePathCommandsBlob(
      [...outline.slice(0, 3), { type: 'unknown', x: 999 }, ...outline.slice(3)],
      2
    )
  ).toEqual(encodePathCommandsBlob(outline, 2))
})

test('packs repeated contours exactly and owns each returned buffer', () => {
  const contour = encodePathCommandsBlob(outline, 2)
  const copies = 1000
  const bytes = encodePathCommandsBlob(Array.from({ length: copies }, () => outline).flat(), 2)
  expect(bytes.length).toBe(copies * contour.length)
  for (let index = 0; index < copies; index++) {
    expect(bytes.subarray(index * contour.length, (index + 1) * contour.length)).toEqual(contour)
  }
  const another = encodePathCommandsBlob(outline, 2)
  another.fill(0)
  expect(bytes.subarray(0, contour.length)).toEqual(contour)
})
