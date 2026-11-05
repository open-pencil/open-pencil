import { describe, expect, test } from 'bun:test'

import { countInstalls, type StepCount } from '#feedback/admin/installs'
import { parseDate } from '@internationalized/date'

/** Desktop step counts as `[day, step, entered, count]`. */
const desktop = (counts: [string, string, 0 | 1, number][]): StepCount[] =>
  counts.map(([day, step, entered, count]) => ({ day, app: 'desktop', step, entered, count }))

describe('install steps', () => {
  test('real installs moving through the steps all count', () => {
    const rows = desktop([
      // Ten installs start, six come back the next day, four a day after, three of them again,
      // and two reach their fifth day.
      ['2026-10-14', '1', 1, 10],
      ['2026-10-15', '2', 1, 6],
      ['2026-10-16', '3-4', 1, 4],
      ['2026-10-17', '3-4', 0, 3],
      ['2026-10-18', '5-8', 1, 2]
    ])

    expect(countInstalls(rows, parseDate('2026-10-18'))).toEqual([
      { day: '2026-10-14', new: 10, returning: 0, replayed: 0 },
      { day: '2026-10-15', new: 0, returning: 6, replayed: 0 },
      { day: '2026-10-16', new: 0, returning: 4, replayed: 0 },
      { day: '2026-10-17', new: 0, returning: 3, replayed: 0 },
      { day: '2026-10-18', new: 0, returning: 2, replayed: 0 }
    ])
  })

  test('a restored copy replaying a step counts only as far as the steps before reach', () => {
    const rows = desktop([
      ['2026-10-14', '1', 1, 10],
      // Beside six real installs, a saved state restored a thousand times a day replays its
      // second day.
      ['2026-10-15', '2', 1, 6 + 1000],
      ['2026-10-16', '2', 1, 1000],
      ['2026-10-16', '3-4', 1, 4]
    ])

    expect(countInstalls(rows, parseDate('2026-10-16'))).toEqual([
      { day: '2026-10-14', new: 10, returning: 0, replayed: 0 },
      // The second step holds at most the ten installs that started: the six real ones and four
      // of the copies, never fewer than the real ones.
      { day: '2026-10-15', new: 0, returning: 10, replayed: 996 },
      // Its ten are used up; the third step holds at most the ten that entered the second.
      { day: '2026-10-16', new: 0, returning: 4, replayed: 1000 }
    ])
  })

  test('a step entered too soon after the one before counts nothing', () => {
    const rows = desktop([
      ['2026-10-14', '1', 1, 5],
      ['2026-10-15', '2', 1, 5],
      // Entering 3-4 takes a day in step 2 first, so the 15th's arrivals can't enter on the 15th.
      ['2026-10-15', '3-4', 1, 5]
    ])

    expect(countInstalls(rows, parseDate('2026-10-15')).at(-1)).toEqual({
      day: '2026-10-15',
      new: 0,
      returning: 5,
      replayed: 5
    })
  })

  test('a step nothing entered counts nothing, however long it runs', () => {
    const rows = desktop([
      ['2026-10-14', '1', 1, 3],
      ['2026-10-14', '5-8', 0, 500],
      ['2026-10-15', '65+', 0, 500]
    ])

    expect(countInstalls(rows, parseDate('2026-10-15'))).toEqual([
      { day: '2026-10-14', new: 3, returning: 0, replayed: 500 },
      { day: '2026-10-15', new: 0, returning: 0, replayed: 500 }
    ])
  })

  test('a step counts each install at most as many days as it spans', () => {
    // Four installs enter 3-4, which spans two days: eight pings at most, however they spread.
    const rows = desktop([
      ['2026-10-14', '1', 1, 4],
      ['2026-10-15', '2', 1, 4],
      ['2026-10-16', '3-4', 1, 4],
      ['2026-10-17', '3-4', 0, 4],
      ['2026-10-18', '3-4', 0, 4]
    ])

    expect(countInstalls(rows, parseDate('2026-10-18')).map((day) => day.replayed)).toEqual([
      0, 0, 0, 0, 4
    ])
  })

  test('copies restored before their first ping count as new: nothing comes before them', () => {
    const rows = desktop([['2026-10-14', '1', 1, 200]])

    expect(countInstalls(rows, parseDate('2026-10-14'))).toEqual([
      { day: '2026-10-14', new: 200, returning: 0, replayed: 0 }
    ])
  })

  test('each app has its own steps', () => {
    const rows: StepCount[] = [
      { day: '2026-10-14', app: 'web', step: '1', entered: 1, count: 5 },
      { day: '2026-10-15', app: 'desktop', step: '2', entered: 1, count: 5 }
    ]

    expect(countInstalls(rows, parseDate('2026-10-15')).at(-1)).toEqual({
      day: '2026-10-15',
      new: 0,
      returning: 0,
      replayed: 5
    })
  })
})
