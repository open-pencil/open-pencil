import { describe, expect, test } from 'bun:test'

import { fuzzyFilter, fuzzySearch } from '#vue/shared/search/fuzzy'

const items = [
  { name: 'Zoom to fit', keywords: 'view' },
  { name: 'Zoom in', keywords: 'view' },
  { name: 'Variables', keywords: 'tokens design tokens' }
]

describe('fuzzy search', () => {
  test('ranks the closest match first and forgives a typo', () => {
    expect(fuzzySearch(items, ['name'], 'zoom in').map((item) => item.name)[0]).toBe('Zoom in')
    expect(fuzzySearch(items, ['name'], 'varibles').map((item) => item.name)).toEqual([
      'Variables'
    ])
  })

  test('searches every key it is given', () => {
    expect(fuzzySearch(items, ['name', 'keywords'], 'tokens').map((item) => item.name)).toEqual([
      'Variables'
    ])
  })

  test('filtering keeps the list order and an empty query keeps everything', () => {
    expect(fuzzyFilter(items, ['name'], 'zoom').map((item) => item.name)).toEqual([
      'Zoom to fit',
      'Zoom in'
    ])
    expect(fuzzyFilter(items, ['name'], '  ')).toEqual(items)
  })
})
