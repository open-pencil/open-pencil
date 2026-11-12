import { expect, test } from 'bun:test'

import { gridPosition, PAGE_COLUMNS, PAGE_GAP } from '@/app/live-pages/grid'

test('pages fill a row left to right with room between frames', () => {
  expect(gridPosition(0, 1440, 900)).toEqual({ x: 0, y: 0 })
  expect(gridPosition(1, 1440, 900)).toEqual({ x: 1440 + PAGE_GAP, y: 0 })
  expect(gridPosition(PAGE_COLUMNS - 1, 1440, 900)).toEqual({
    x: (PAGE_COLUMNS - 1) * (1440 + PAGE_GAP),
    y: 0
  })
})

test('the next row starts under the first one', () => {
  expect(gridPosition(PAGE_COLUMNS, 400, 300)).toEqual({ x: 0, y: 300 + PAGE_GAP })
})
