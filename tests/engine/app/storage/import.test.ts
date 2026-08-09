import { describe, expect, test } from 'bun:test'

import {
  isSupportedStorageFile,
  storageFormatForFile,
  storageNameFromFile
} from '@/app/storage/import'

describe('storage imports', () => {
  test('reads the format from the extension, case-insensitively', () => {
    expect(storageFormatForFile('Pitch.deck')).toBe('deck')
    expect(storageFormatForFile('Pitch.DECK')).toBe('deck')
    expect(storageFormatForFile('Logo.fig')).toBe('fig')
    expect(storageFormatForFile('Logo.FIG')).toBe('fig')
  })

  test('rejects anything else', () => {
    expect(storageFormatForFile('Slides.pptx')).toBeNull()
    expect(storageFormatForFile('Deck')).toBeNull()
    expect(isSupportedStorageFile('notes.txt')).toBe(false)
    expect(isSupportedStorageFile('notes.fig')).toBe(true)
  })

  test('derives a stable storage name from the file name', () => {
    expect(storageNameFromFile('Quarterly review.deck')).toBe('Quarterly review')
    expect(storageNameFromFile('Brand system.fig')).toBe('Brand system')
    expect(storageNameFromFile('.deck')).toBe('Untitled')
    expect(storageNameFromFile('.fig')).toBe('Untitled')
    // Only the trailing extension goes; an inner one is part of the name.
    expect(storageNameFromFile('v2.fig.deck')).toBe('v2.fig')
  })
})
