import { describe, expect, test } from 'bun:test'

import { isDeckStorageFile, storageNameFromDeckFile } from '@/app/storage/import'

describe('storage deck imports', () => {
  test('accepts deck extensions case-insensitively', () => {
    expect(isDeckStorageFile('Pitch.deck')).toBe(true)
    expect(isDeckStorageFile('Pitch.DECK')).toBe(true)
    expect(isDeckStorageFile('Pitch.fig')).toBe(false)
  })

  test('derives a stable storage name from the file name', () => {
    expect(storageNameFromDeckFile('Quarterly review.deck')).toBe('Quarterly review')
    expect(storageNameFromDeckFile('.deck')).toBe('Untitled')
  })
})
