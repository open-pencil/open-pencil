import { describe, expect, test } from 'bun:test'

import { findFigThumbnailPageId } from '#core/io/formats/fig/thumbnail-page'

describe('FIG thumbnail page selection', () => {
  test('prefers an exact Cover page case-insensitively', () => {
    expect(
      findFigThumbnailPageId([
        { id: 'first', name: 'Cover archive' },
        { id: 'exact', name: '  COVER  ' },
        { id: 'last', name: 'Cover v2' }
      ])
    ).toBe('exact')
  })

  test('uses the first page containing Cover when no exact match exists', () => {
    expect(
      findFigThumbnailPageId([
        { id: 'unrelated', name: 'Homepage' },
        { id: 'first-cover', name: '✨ Project cover' },
        { id: 'second-cover', name: 'Cover archive' }
      ])
    ).toBe('first-cover')
  })

  test('does not fall back to an unrelated page', () => {
    expect(findFigThumbnailPageId([{ id: 'first', name: 'Homepage' }])).toBeUndefined()
  })
})
