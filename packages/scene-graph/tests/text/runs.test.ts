import { describe, expect, test } from 'bun:test'

import type { StyleRun } from '@open-pencil/scene-graph'
import {
  appendStyleRun,
  characterOverrides,
  styleRunAt,
  styleRunPieces,
  textLanguageAt
} from '@open-pencil/scene-graph/text'

const BOLD = { fontWeight: 700 }
const ITALIC = { italic: true }

describe('style runs', () => {
  test('finds the run over a character', () => {
    const runs: StyleRun[] = [{ start: 2, length: 3, style: BOLD }]
    expect(styleRunAt(runs, 1)).toBeUndefined()
    expect(styleRunAt(runs, 2)?.style).toBe(BOLD)
    expect(styleRunAt(runs, 4)?.style).toBe(BOLD)
    expect(styleRunAt(runs, 5)).toBeUndefined()
  })

  test('reads a character’s language from its run, or the text’s', () => {
    const node = {
      textLanguage: 'en',
      styleRuns: [
        { start: 0, length: 2, style: { textLanguage: 'ja' } },
        { start: 2, length: 2, style: { textLanguage: null } }
      ]
    }
    expect(textLanguageAt(node, 0)).toBe('ja')
    expect(textLanguageAt(node, 2)).toBeNull()
    expect(textLanguageAt(node, 4)).toBe('en')
  })

  test('appends runs, extending the last one it adjoins with an equal style', () => {
    const runs: StyleRun[] = []
    appendStyleRun(runs, 0, 2, BOLD)
    appendStyleRun(runs, 2, 3, { fontWeight: 700 })
    appendStyleRun(runs, 5, 1, {})
    appendStyleRun(runs, 6, 0, ITALIC)
    appendStyleRun(runs, 6, 1, BOLD)
    appendStyleRun(runs, 7, 1, ITALIC)
    expect(runs).toEqual([
      { start: 0, length: 5, style: BOLD },
      { start: 6, length: 1, style: BOLD },
      { start: 7, length: 1, style: ITALIC }
    ])
  })

  test('cuts the text into pieces covering each character once', () => {
    const runs: StyleRun[] = [
      { start: 6, length: 10, style: ITALIC },
      { start: 1, length: 3, style: BOLD },
      { start: 2, length: 5, style: ITALIC }
    ]
    expect(styleRunPieces(runs, 8)).toEqual([
      { start: 0, end: 1, style: null },
      { start: 1, end: 4, style: BOLD },
      { start: 4, end: 7, style: ITALIC },
      { start: 7, end: 8, style: ITALIC }
    ])
  })

  test('moves each cut to a boundary it is given', () => {
    const runs: StyleRun[] = [{ start: 1, length: 2, style: BOLD }]
    const even = (index: number) => index + (index % 2)
    expect(styleRunPieces(runs, 6, even)).toEqual([
      { start: 0, end: 2, style: null },
      { start: 2, end: 4, style: BOLD },
      { start: 4, end: 6, style: null }
    ])
  })

  test('leaves out runs past the end of the text', () => {
    const runs: StyleRun[] = [{ start: 5, length: 2, style: BOLD }]
    expect(styleRunPieces(runs, 3)).toEqual([{ start: 0, end: 3, style: null }])
    expect(styleRunPieces([], 0)).toEqual([])
  })

  test('merges each character’s overrides from the runs over it', () => {
    const runs: StyleRun[] = [
      { start: 0, length: 2, style: BOLD },
      { start: 1, length: 5, style: ITALIC }
    ]
    expect(characterOverrides(runs, 3)).toEqual([BOLD, { ...BOLD, ...ITALIC }, ITALIC])
  })
})
