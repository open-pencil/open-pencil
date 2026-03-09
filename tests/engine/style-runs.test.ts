import { describe, test, expect } from 'bun:test'

import {
  getStyleAt,
  applyStyleToRange,
  removeStyleFromRange,
  selectionHasStyle,
  adjustRunsForInsert,
  adjustRunsForDelete,
  toggleBoldInRange,
  toggleItalicInRange,
  toggleDecorationInRange,
  type StyleRun,
} from '@open-pencil/core'

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

describe('adjustRunsForInsert', () => {
  test('insert before run shifts start', () => {
    const runs: StyleRun[] = [{ start: 5, length: 3, style: { fontWeight: 700 } }]
    const adjusted = adjustRunsForInsert(runs, 2, 4)
    expect(adjusted[0].start).toBe(9)
    expect(adjusted[0].length).toBe(3)
  })

  test('insert inside run extends length', () => {
    const runs: StyleRun[] = [{ start: 2, length: 6, style: { fontWeight: 700 } }]
    const adjusted = adjustRunsForInsert(runs, 4, 3)
    expect(adjusted[0].start).toBe(2)
    expect(adjusted[0].length).toBe(9)
  })

  test('insert after run leaves it unchanged', () => {
    const runs: StyleRun[] = [{ start: 0, length: 3, style: { fontWeight: 700 } }]
    const adjusted = adjustRunsForInsert(runs, 10, 5)
    expect(adjusted[0]).toEqual({ start: 0, length: 3, style: { fontWeight: 700 } })
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
    const { runs, newWeight } = toggleBoldInRange(existing, 0, 5, 400, 10)
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
