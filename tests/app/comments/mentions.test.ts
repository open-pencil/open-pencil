import { describe, expect, test } from 'bun:test'

import { COMMENT_MENTION, mentionPlugin } from '@/app/comments/mention-plugin'
import {
  mentionedAccounts,
  mentionLink,
  mentionQuery,
  withMentionLinks
} from '@/app/comments/mentions'
import { createMarkdownParser } from '@/app/shell/markdown/config'

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
    const text = withMentionLinks('hi @Ann [ops] *', [odd])
    expect(text).toBe(`hi ${mentionLink(odd)}`)
    expect(mentionedAccounts(text)).toEqual(['acc-odd'])
  })

  test('name each account a comment links to once, and nothing else', () => {
    const text = withMentionLinks('@Ana @Ana Lee @Ana', [ana, anaLee])
    expect(mentionedAccounts(text)).toEqual(['acc-ana', 'acc-ana-lee'])
    expect(mentionedAccounts('[@Ana](https://example.com) `[@x](openpencil://person/y)`')).toEqual(
      []
    )
  })

  test('render mentions as their element, other links as links', async () => {
    const parse = await createMarkdownParser(false, undefined, [mentionPlugin()])
    const { nodes } = await parse('Hi [@Ana](openpencil://person/acc-ana), see [it](https://a.b)')
    expect(JSON.stringify(nodes)).toContain(
      JSON.stringify([COMMENT_MENTION, { target: 'acc-ana' }, '@Ana'])
    )
    expect(JSON.stringify(nodes)).toContain('"href":"https://a.b"')
  })

  test('find the name being typed after an @', () => {
    expect(mentionQuery('Hi @An', 6)).toEqual({ query: 'An', start: 3 })
    expect(mentionQuery('@', 1)).toEqual({ query: '', start: 0 })
    expect(mentionQuery('mail@example', 12)).toBeNull()
    expect(mentionQuery('@Ana done', 9)).toBeNull()
  })
})
