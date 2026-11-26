import { describe, expect, test } from 'bun:test'

import { commentExcerpt } from '#cloud/server/comments/notify'

describe('comment excerpt', () => {
  test('reads mentions and links as their text, on one line', () => {
    expect(
      commentExcerpt('[@Ana](openpencil://person/1) see\n\n[the \\[spec\\]](https://example.com)')
    ).toBe('@Ana see the [spec]')
  })

  test('ends a long comment with an ellipsis', () => {
    const excerpt = commentExcerpt('word '.repeat(100))
    expect(excerpt.length).toBe(280)
    expect(excerpt.endsWith('…')).toBe(true)
  })
})
