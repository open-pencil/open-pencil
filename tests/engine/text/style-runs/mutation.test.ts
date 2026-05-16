import { describe, test, expect } from 'bun:test'

import {
  applyStyleToRange,
  getStyleAt,
  removeStyleFromRange,
  toggleBoldInRange,
  toggleItalicInRange,
  type StyleRun
} from '@open-pencil/core'

// ---------------------------------------------------------------------------
// toggleBoldInRange — mutation coverage
// ---------------------------------------------------------------------------

describe('toggleBoldInRange — partial bold → all bold', () => {
  test('mixed selection (some bold, some not) becomes all bold', () => {
    // chars 0-2 bold, chars 3-4 not — toggle on [0,5) should make all bold
    const runs: StyleRun[] = [{ start: 0, length: 3, style: { fontWeight: 700 } }]
    const { runs: result, newWeight } = toggleBoldInRange(runs, 0, 5, 400, 5)
    expect(newWeight).toBe(700)
    for (let i = 0; i < 5; i++) {
      expect(getStyleAt(result, i).fontWeight ?? 400).toBe(700)
    }
  })

  test('node-level weight 700 — chars without run override treated as bold', () => {
    // nodeWeight=700, no runs → all chars "bold" → toggle removes bold
    const { newWeight } = toggleBoldInRange([], 0, 5, 700, 5)
    expect(newWeight).toBe(400)
  })

  test('partial range: only middle chars toggled, edges unchanged', () => {
    const runs: StyleRun[] = []
    const { runs: result } = toggleBoldInRange(runs, 2, 6, 400, 10)
    // chars 0-1 and 6-9 should have no fontWeight override
    expect(getStyleAt(result, 0).fontWeight).toBeUndefined()
    expect(getStyleAt(result, 1).fontWeight).toBeUndefined()
    // chars 2-5 should be 700
    for (let i = 2; i < 6; i++) {
      expect(getStyleAt(result, i).fontWeight).toBe(700)
    }
    expect(getStyleAt(result, 6).fontWeight).toBeUndefined()
  })

  test('toggling bold twice returns to original state', () => {
    const runs: StyleRun[] = []
    const { runs: bolded } = toggleBoldInRange(runs, 0, 5, 400, 5)
    const { runs: restored } = toggleBoldInRange(bolded, 0, 5, 400, 5)
    // all chars should have no fontWeight override (back to node default)
    for (let i = 0; i < 5; i++) {
      expect(getStyleAt(restored, i).fontWeight).toBeUndefined()
    }
  })

  test('does not mutate original runs array', () => {
    const original: StyleRun[] = [{ start: 0, length: 3, style: { fontWeight: 700 } }]
    const snapshot = JSON.stringify(original)
    toggleBoldInRange(original, 0, 3, 400, 5)
    expect(JSON.stringify(original)).toBe(snapshot)
  })
})

describe('toggleItalicInRange — mutation coverage', () => {
  test('partial italic → all italic', () => {
    const runs: StyleRun[] = [{ start: 0, length: 2, style: { italic: true } }]
    const { newItalic, runs: result } = toggleItalicInRange(runs, 0, 5, false, 5)
    expect(newItalic).toBe(true)
    for (let i = 0; i < 5; i++) {
      expect(getStyleAt(result, i).italic ?? false).toBe(true)
    }
  })

  test('node-level italic=true, no runs → toggles off', () => {
    const { newItalic } = toggleItalicInRange([], 0, 5, true, 5)
    expect(newItalic).toBe(false)
  })

  test('toggling italic twice restores original', () => {
    const { runs: italicized } = toggleItalicInRange([], 0, 5, false, 5)
    const { runs: restored } = toggleItalicInRange(italicized, 0, 5, false, 5)
    for (let i = 0; i < 5; i++) {
      expect(getStyleAt(restored, i).italic).toBeUndefined()
    }
  })
})

describe('applyStyleToRange — split and merge', () => {
  test('applying to middle of existing run splits it', () => {
    const runs: StyleRun[] = [{ start: 0, length: 10, style: { fontWeight: 700 } }]
    // apply italic only to chars 3-6
    const result = applyStyleToRange(runs, 3, 7, { italic: true }, 10)
    // chars 0-2: bold only
    expect(getStyleAt(result, 0)).toEqual({ fontWeight: 700 })
    expect(getStyleAt(result, 2)).toEqual({ fontWeight: 700 })
    // chars 3-6: bold + italic
    expect(getStyleAt(result, 3)).toEqual({ fontWeight: 700, italic: true })
    expect(getStyleAt(result, 6)).toEqual({ fontWeight: 700, italic: true })
    // chars 7-9: bold only
    expect(getStyleAt(result, 7)).toEqual({ fontWeight: 700 })
  })

  test('applying same style merges adjacent runs', () => {
    const runs: StyleRun[] = [
      { start: 0, length: 3, style: { fontWeight: 700 } },
      { start: 5, length: 3, style: { fontWeight: 700 } }
    ]
    // fill the gap between them
    const result = applyStyleToRange(runs, 3, 5, { fontWeight: 700 }, 10)
    // should compact into one run
    const bold700Count = result.filter((r) => r.style.fontWeight === 700).length
    expect(bold700Count).toBe(1)
    expect(result[0].length).toBe(8)
  })

  test('overwriting a property in range does not affect chars outside', () => {
    const runs: StyleRun[] = [{ start: 0, length: 10, style: { fontWeight: 400 } }]
    const result = applyStyleToRange(runs, 5, 10, { fontWeight: 700 }, 10)
    expect(getStyleAt(result, 4).fontWeight).toBe(400)
    expect(getStyleAt(result, 5).fontWeight).toBe(700)
    expect(getStyleAt(result, 9).fontWeight).toBe(700)
  })
})

describe('removeStyleFromRange — edge cases', () => {
  test('removing non-existent key leaves run intact', () => {
    const runs: StyleRun[] = [{ start: 0, length: 5, style: { italic: true } }]
    const result = removeStyleFromRange(runs, 0, 5, ['fontWeight'], 5)
    expect(getStyleAt(result, 0).italic).toBe(true)
    expect(result).toHaveLength(1)
  })

  test('removing all keys from run eliminates the run', () => {
    const runs: StyleRun[] = [{ start: 0, length: 5, style: { fontWeight: 700 } }]
    const result = removeStyleFromRange(runs, 0, 5, ['fontWeight'], 5)
    expect(result).toHaveLength(0)
  })

  test('partial removal preserves surrounding runs', () => {
    const runs: StyleRun[] = [{ start: 0, length: 10, style: { fontWeight: 700 } }]
    const result = removeStyleFromRange(runs, 3, 7, ['fontWeight'], 10)
    // chars 0-2 still bold
    expect(getStyleAt(result, 0).fontWeight).toBe(700)
    // chars 3-6 no override
    expect(getStyleAt(result, 3).fontWeight).toBeUndefined()
    // chars 7-9 still bold
    expect(getStyleAt(result, 7).fontWeight).toBe(700)
  })
})

