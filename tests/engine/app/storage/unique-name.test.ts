import { describe, expect, test } from 'bun:test'

import { nextUniqueStorageName } from '@/app/storage/unique-name'

describe('nextUniqueStorageName', () => {
  test('returns desired name when free', () => {
    expect(nextUniqueStorageName('KonversioDesigns', [])).toBe('KonversioDesigns')
    expect(nextUniqueStorageName('KonversioDesigns', ['Other'])).toBe('KonversioDesigns')
  })

  test('appends (1), (2), … when name is taken', () => {
    expect(nextUniqueStorageName('File', ['File'])).toBe('File (1)')
    expect(nextUniqueStorageName('File', ['File', 'File (1)'])).toBe('File (2)')
    expect(nextUniqueStorageName('File', ['File', 'File (1)', 'File (2)'])).toBe('File (3)')
  })

  test('skips gaps and picks the first free number', () => {
    expect(nextUniqueStorageName('File', ['File', 'File (2)'])).toBe('File (1)')
  })

  test('trims whitespace and falls back to Untitled', () => {
    expect(nextUniqueStorageName('  Draft  ', ['Draft'])).toBe('Draft (1)')
    expect(nextUniqueStorageName('   ', ['Untitled'])).toBe('Untitled (1)')
    expect(nextUniqueStorageName('', [])).toBe('Untitled')
  })

  test('ignores blank taken names', () => {
    expect(nextUniqueStorageName('A', ['', '  ', 'A'])).toBe('A (1)')
  })

  test('treats Name (1) as a distinct base', () => {
    // Importing a file already named "File (1)" when that display name exists.
    expect(nextUniqueStorageName('File (1)', ['File (1)'])).toBe('File (1) (1)')
  })
})
