import { describe, expect, test } from 'bun:test'

import {
  documentNameFromFigPath,
  downloadNameFromPath,
  figDownloadName
} from '@/app/document/io/names'

describe('document names from paths', () => {
  test('take the last segment of POSIX and Windows paths alike', () => {
    expect(documentNameFromFigPath('/Users/me/Landing page.fig')).toBe('Landing page')
    expect(documentNameFromFigPath('C:\\Users\\me\\Landing page.FIG')).toBe('Landing page')
    expect(downloadNameFromPath('C:\\Users\\me\\Landing page.fig')).toBe('Landing page.fig')
  })

  test('fall back to Untitled for a path with no file name', () => {
    expect(documentNameFromFigPath('')).toBe('Untitled')
    expect(downloadNameFromPath('')).toBe('Untitled.fig')
  })

  test('save a document read from another format under a .fig name', () => {
    expect(figDownloadName('Landing.fig', 'fig')).toBe('Landing.fig')
    expect(figDownloadName('Landing.pen', 'pen')).toBe('Landing.fig')
    expect(figDownloadName('Landing', 'html')).toBe('Landing.fig')
  })
})
