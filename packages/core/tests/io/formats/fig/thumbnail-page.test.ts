import { describe, expect, test } from 'bun:test'

import { figThumbnailPageId } from '#core/io/formats/fig/thumbnail-page'

describe('FIG thumbnail page selection', () => {
  test('prefers an exact Cover page case-insensitively', () => {
    expect(
      figThumbnailPageId([
        { id: 'first', name: 'Cover archive' },
        { id: 'exact', name: '  COVER  ' },
        { id: 'last', name: 'Cover v2' }
      ])
    ).toBe('exact')
  })

  test('uses the first page containing Cover when no exact match exists', () => {
    expect(
      figThumbnailPageId([
        { id: 'unrelated', name: 'Homepage' },
        { id: 'first-cover', name: '✨ Project cover' },
        { id: 'second-cover', name: 'Cover archive' }
      ])
    ).toBe('first-cover')
  })

  // Live Figma 2026-10-25: a file saved with pages "Page 1" and "Second" and no Cover page embeds
  // a thumbnail of "Page 1".
  test('uses the first page when there is no Cover page, as Figma does', () => {
    expect(
      figThumbnailPageId([
        { id: 'first', name: 'Page 1' },
        { id: 'second', name: 'Second' }
      ])
    ).toBe('first')
    expect(figThumbnailPageId([])).toBeUndefined()
  })
})
