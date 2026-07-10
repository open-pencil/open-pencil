import { describe, expect, test } from 'bun:test'

import { nextUniqueCloudName } from '@/app/cloud/unique-name'

describe('nextUniqueCloudName', () => {
  test('returns desired name when free', () => {
    expect(nextUniqueCloudName('KonversioDesigns', [])).toBe('KonversioDesigns')
    expect(nextUniqueCloudName('KonversioDesigns', ['Other'])).toBe('KonversioDesigns')
  })

  test('appends (1), (2), … when name is taken', () => {
    expect(nextUniqueCloudName('File', ['File'])).toBe('File (1)')
    expect(nextUniqueCloudName('File', ['File', 'File (1)'])).toBe('File (2)')
    expect(nextUniqueCloudName('File', ['File', 'File (1)', 'File (2)'])).toBe('File (3)')
  })

  test('skips gaps and picks the first free number', () => {
    expect(nextUniqueCloudName('File', ['File', 'File (2)'])).toBe('File (1)')
  })

  test('trims whitespace and falls back to Untitled', () => {
    expect(nextUniqueCloudName('  Draft  ', ['Draft'])).toBe('Draft (1)')
    expect(nextUniqueCloudName('   ', ['Untitled'])).toBe('Untitled (1)')
    expect(nextUniqueCloudName('', [])).toBe('Untitled')
  })

  test('ignores blank taken names', () => {
    expect(nextUniqueCloudName('A', ['', '  ', 'A'])).toBe('A (1)')
  })

  test('treats Name (1) as a distinct base', () => {
    // Importing a file already named "File (1)" when that display name exists.
    expect(nextUniqueCloudName('File (1)', ['File (1)'])).toBe('File (1) (1)')
  })
})
