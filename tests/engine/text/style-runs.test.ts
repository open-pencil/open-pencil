import { describe, expect, test } from 'bun:test'

import {
  adjustRunsForDelete,
  applyStyleToRange,
  getStyleAt,
  insertRunsWithStyle,
  removeStyleFromRange,
  runsAfterTyping,
  selectionHasStyle,
  toggleBoldInRange,
  toggleDecorationInRange,
  toggleItalicInRange
} from '@open-pencil/core/text'
import type { StyleRun } from '@open-pencil/scene-graph'

describe('getStyleAt', () => {
  test('returns style within run', () => {
    const runs: StyleRun[] = [{ start: 2, length: 3, style: { fontWeight: 700 } }]
    expect(getStyleAt(runs, 3)).toEqual({ fontWeight: 700 })
  })

  test('returns empty object outside runs', () => {
    const runs: StyleRun[] = [{ start: 5, length: 2, style: { fontWeight: 700 } }]
    expect(getStyleAt(runs, 0)).toEqual({})
  })
})

describe('applyStyleToRange', () => {
  test('applies bold to range', () => {
    const runs = applyStyleToRange([], 2, 5, { fontWeight: 700 }, 10)
    expect(runs).toHaveLength(1)
    expect(runs[0].start).toBe(2)
    expect(runs[0].length).toBe(3)
    expect(runs[0].style.fontWeight).toBe(700)
  })

  test('merges with existing style', () => {
    const existing: StyleRun[] = [{ start: 0, length: 5, style: { fontWeight: 700 } }]
    const runs = applyStyleToRange(existing, 2, 4, { italic: true }, 10)
    const style = getStyleAt(runs, 3)
    expect(style.fontWeight).toBe(700)
    expect(style.italic).toBe(true)
  })
})

describe('removeStyleFromRange', () => {
  test('removes keys from range', () => {
    const existing: StyleRun[] = [{ start: 0, length: 5, style: { fontWeight: 700, italic: true } }]
    const runs = removeStyleFromRange(existing, 0, 5, ['fontWeight'], 10)
    const style = getStyleAt(runs, 2)
    expect(style.fontWeight).toBeUndefined()
    expect(style.italic).toBe(true)
  })
})

describe('selectionHasStyle', () => {
  test('all chars have style', () => {
    const runs: StyleRun[] = [{ start: 0, length: 5, style: { fontWeight: 700 } }]
    expect(selectionHasStyle(runs, 0, 5, 'fontWeight', 700)).toBe(true)
  })

  test('some chars missing', () => {
    const runs: StyleRun[] = [{ start: 0, length: 3, style: { fontWeight: 700 } }]
    expect(selectionHasStyle(runs, 0, 5, 'fontWeight', 700)).toBe(false)
  })
})

describe('runsAfterTyping', () => {
  const bold: StyleRun = { start: 2, length: 3, style: { fontWeight: 700 } }

  test('typing before a run shifts it', () => {
    expect(runsAfterTyping([bold], 8, 1, 1, 4)).toEqual([{ ...bold, start: 6 }])
  })

  test('typing inside a run extends it', () => {
    expect(runsAfterTyping([bold], 8, 3, 3, 2)).toEqual([{ ...bold, length: 5 }])
  })

  test('typing at the end of a run extends it', () => {
    expect(runsAfterTyping([bold], 8, 5, 5, 2)).toEqual([{ ...bold, length: 5 }])
  })

  test('typing at the start of a run takes the style before it', () => {
    expect(runsAfterTyping([bold], 8, 2, 2, 1)).toEqual([{ ...bold, start: 3 }])
  })

  test('typing at the start of the text takes the first character style', () => {
    const leading: StyleRun = { start: 0, length: 3, style: { fontWeight: 700 } }
    expect(runsAfterTyping([leading], 8, 0, 0, 2)).toEqual([{ ...leading, length: 5 }])
  })

  test('typing over a selection takes the style of its first character', () => {
    expect(runsAfterTyping([bold], 8, 4, 7, 2)).toEqual([{ ...bold, length: 4 }])
    expect(runsAfterTyping([bold], 8, 1, 4, 1)).toEqual([{ ...bold, start: 2, length: 1 }])
  })

  test('typing into an empty text adds no runs', () => {
    expect(runsAfterTyping([], 0, 0, 0, 3)).toEqual([])
  })
})

describe('insertRunsWithStyle', () => {
  const bold = { fontWeight: 700 }

  test('merges the inserted run with an equal-styled neighbour on either side', () => {
    const runs: StyleRun[] = [
      { start: 0, length: 2, style: bold },
      { start: 2, length: 2, style: bold }
    ]
    expect(insertRunsWithStyle(runs, 2, 2, bold)).toEqual([{ start: 0, length: 6, style: bold }])
  })

  test('leaves equal-styled runs away from the insert as they were', () => {
    const runs: StyleRun[] = [
      { start: 0, length: 2, style: bold },
      { start: 2, length: 2, style: bold },
      { start: 6, length: 2, style: bold }
    ]
    expect(insertRunsWithStyle(runs, 5, 1, {})).toEqual([
      { start: 0, length: 2, style: bold },
      { start: 2, length: 2, style: bold },
      { start: 7, length: 2, style: bold }
    ])
  })

  test('keeps a neighbour with another style apart from the inserted run', () => {
    const italic = { italic: true }
    const runs: StyleRun[] = [{ start: 0, length: 2, style: italic }]
    expect(insertRunsWithStyle(runs, 2, 3, bold)).toEqual([
      { start: 0, length: 2, style: italic },
      { start: 2, length: 3, style: bold }
    ])
  })
})

describe('adjustRunsForDelete', () => {
  test('delete before run shifts start', () => {
    const runs: StyleRun[] = [{ start: 10, length: 5, style: { fontWeight: 700 } }]
    const adjusted = adjustRunsForDelete(runs, 2, 3)
    expect(adjusted[0].start).toBe(7)
    expect(adjusted[0].length).toBe(5)
  })

  test('delete inside run shrinks length', () => {
    const runs: StyleRun[] = [{ start: 0, length: 10, style: { fontWeight: 700 } }]
    const adjusted = adjustRunsForDelete(runs, 3, 4)
    expect(adjusted[0].length).toBe(6)
  })

  test('delete entire run removes it', () => {
    const runs: StyleRun[] = [{ start: 2, length: 3, style: { fontWeight: 700 } }]
    const adjusted = adjustRunsForDelete(runs, 2, 3)
    expect(adjusted).toHaveLength(0)
  })

  test('delete after run leaves it unchanged', () => {
    const runs: StyleRun[] = [{ start: 0, length: 3, style: { fontWeight: 700 } }]
    const adjusted = adjustRunsForDelete(runs, 5, 2)
    expect(adjusted[0]).toEqual({ start: 0, length: 3, style: { fontWeight: 700 } })
  })
})

describe('toggleBoldInRange', () => {
  test('non-bold to bold', () => {
    const { runs, newWeight } = toggleBoldInRange([], 0, 5, 400, 10)
    expect(newWeight).toBe(700)
    expect(runs).toHaveLength(1)
    expect(runs[0].style.fontWeight).toBe(700)
  })

  test('bold to non-bold', () => {
    const existing: StyleRun[] = [{ start: 0, length: 5, style: { fontWeight: 700 } }]
    const { newWeight } = toggleBoldInRange(existing, 0, 5, 400, 10)
    expect(newWeight).toBe(400)
  })
})

describe('toggleItalicInRange', () => {
  test('toggle on', () => {
    const { runs, newItalic } = toggleItalicInRange([], 0, 5, false, 10)
    expect(newItalic).toBe(true)
    expect(runs[0].style.italic).toBe(true)
  })

  test('toggle off', () => {
    const existing: StyleRun[] = [{ start: 0, length: 5, style: { italic: true } }]
    const { newItalic } = toggleItalicInRange(existing, 0, 5, false, 10)
    expect(newItalic).toBe(false)
  })
})

describe('toggleDecorationInRange', () => {
  test('add underline', () => {
    const { newDeco } = toggleDecorationInRange([], 0, 5, 'UNDERLINE', 'NONE', 10)
    expect(newDeco).toBe('UNDERLINE')
  })

  test('remove underline', () => {
    const existing: StyleRun[] = [{ start: 0, length: 5, style: { textDecoration: 'UNDERLINE' } }]
    const { newDeco } = toggleDecorationInRange(existing, 0, 5, 'UNDERLINE', 'NONE', 10)
    expect(newDeco).toBe('NONE')
  })
})
