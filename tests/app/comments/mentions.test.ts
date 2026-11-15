import { describe, expect, test } from 'bun:test'

import {
  mentionComponents,
  mentionedAccounts,
  mentionQuery,
  withMentionLinks
} from '@/app/comments/mentions'

const ana = { id: 'acc-ana', name: 'Ana' }
const anaLee = { id: 'acc-ana-lee', name: 'Ana Lee' }

describe('comment mentions', () => {
  test('turn the names picked while writing into links, whole names only', () => {
    expect(withMentionLinks('@Ana and @Ana Lee, not @Anabel', [ana, anaLee])).toBe(
      '[@Ana](openpencil://person/acc-ana) and [@Ana Lee](openpencil://person/acc-ana-lee), not @Anabel'
    )
    // Someone typed but never picked stays text.
    expect(withMentionLinks('@Ben look', [ana])).toBe('@Ben look')
  })

  test('name each account a comment links to once', () => {
    const text = withMentionLinks('@Ana @Ana Lee @Ana', [ana, anaLee])
    expect(mentionedAccounts(text)).toEqual(['acc-ana', 'acc-ana-lee'])
    expect(mentionedAccounts('[@Ana](https://example.com)')).toEqual([])
  })

  test('render mentions as their component, other links as links', () => {
    expect(mentionComponents('Hi [@Ana](openpencil://person/acc-ana), see [it](https://a.b)')).toBe(
      'Hi :comment-mention[@Ana]{target="acc-ana" label="@Ana"}, see [it](https://a.b)'
    )
  })

  test('find the name being typed after an @', () => {
    expect(mentionQuery('Hi @An', 6)).toEqual({ query: 'An', start: 3 })
    expect(mentionQuery('@', 1)).toEqual({ query: '', start: 0 })
    expect(mentionQuery('mail@example', 12)).toBeNull()
    expect(mentionQuery('@Ana done', 9)).toBeNull()
  })
})
