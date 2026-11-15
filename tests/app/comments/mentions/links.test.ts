import { describe, expect, test } from 'bun:test'

import {
  mentionedAccounts,
  mentionLink,
  mentionQuery,
  withMentionLinks
} from '@/app/comments/mentions/links'

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

  test('leave code and other links as they were written', () => {
    expect(withMentionLinks('`@Ana` and [@Ana](https://a.b) and @Ana', [ana])).toBe(
      '`@Ana` and [@Ana](https://a.b) and [@Ana](openpencil://person/acc-ana)'
    )
  })

  test('escape a name as Markdown writes a link’s text', () => {
    const odd = { id: 'acc-odd', name: 'Ann [ops] *' }
    expect(mentionLink(odd)).toBe('[@Ann \\[ops\\] *](openpencil://person/acc-odd)')
    const text = withMentionLinks('hi @Ann [ops] *', [odd])
    expect(mentionedAccounts(text)).toEqual(['acc-odd'])
  })

  test('tell two people of one name apart by the order they were picked in', () => {
    const sam = { id: 'acc-sam', name: 'Sam' }
    const otherSam = { id: 'acc-sam-2', name: 'Sam' }
    expect(mentionedAccounts(withMentionLinks('@Sam and @Sam', [sam, otherSam]))).toEqual([
      'acc-sam',
      'acc-sam-2'
    ])
  })

  test('find names beside escapes, and leave bare URLs alone', () => {
    expect(withMentionLinks('@Ana please write \\* here', [ana])).toBe(
      '[@Ana](openpencil://person/acc-ana) please write \\* here'
    )
    expect(withMentionLinks('https://example.com/@Ana and @Ana', [ana])).toBe(
      'https://example.com/@Ana and [@Ana](openpencil://person/acc-ana)'
    )
  })

  test('name each account a comment links to once, and nothing else', () => {
    const text = withMentionLinks('@Ana @Ana Lee @Ana', [ana, anaLee])
    expect(mentionedAccounts(text)).toEqual(['acc-ana', 'acc-ana-lee'])
    expect(mentionedAccounts('[@Ana](https://example.com) `[@x](openpencil://person/y)`')).toEqual(
      []
    )
  })

  test('find the name being typed after an @', () => {
    expect(mentionQuery('Hi @An', 6)).toEqual({ query: 'An', start: 3 })
    expect(mentionQuery('@', 1)).toEqual({ query: '', start: 0 })
    expect(mentionQuery('mail@example', 12)).toBeNull()
    expect(mentionQuery('@Ana done', 9)).toBeNull()
  })
})
