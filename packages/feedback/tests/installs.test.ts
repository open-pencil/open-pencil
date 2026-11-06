import { describe, expect, test } from 'bun:test'

import { countInstalls, type StepCount } from '#feedback/admin/installs'
import { pingStepOf } from '#feedback/contract'
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

  test('entries too soon give a step nothing to pass on later', () => {
    const rows = desktop([
      // Step 2 entered on the same day as step 1, which no install can do.
      ['2026-10-14', '1', 1, 5],
      ['2026-10-14', '2', 1, 5],
      // A day later the step-1 arrivals could have entered step 2, but nothing did; the next
      // step still has no valid entries behind it.
      ['2026-10-16', '3-4', 1, 5]
    ])

    expect(countInstalls(rows, parseDate('2026-10-16')).map((day) => day.replayed)).toEqual([
      5, 0, 5
    ])
  })

  test('an install pinging every day counts through every step, the last one without end', () => {
    const first = parseDate('2026-01-01')
    const days = 104
    const rows: StepCount[] = Array.from({ length: days }, (_, index) => {
      const { pingDays, enteredStep } = pingStepOf(index + 1)
      return {
        day: first.add({ days: index }).toString(),
        app: 'desktop',
        step: pingDays,
        entered: enteredStep ? 1 : 0,
        count: 1
      }
    })
    // From its 65th day on, a copy of it replays the last step beside it.
    for (let index = 64; index < days; index++) {
      rows.push({
        day: first.add({ days: index }).toString(),
        app: 'desktop',
        step: '65+',
        entered: 0,
        count: 1
      })
    }

    const counted = countInstalls(rows, first.add({ days: days - 1 }))
    expect(counted[0]).toEqual({ day: '2026-01-01', new: 1, returning: 0, replayed: 0 })
    expect(counted.slice(1, 64).every((day) => day.returning === 1 && day.replayed === 0)).toBe(
      true
    )
    expect(counted.slice(64).every((day) => day.returning === 1 && day.replayed === 1)).toBe(true)
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
