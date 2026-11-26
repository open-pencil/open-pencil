import { describe, expect, test } from 'bun:test'

import { COMMENT_MENTION, mentionPlugin } from '@/app/comments/mentions/plugin'
import { createMarkdownParser } from '@/app/shell/markdown/config'

describe('comment mention plugin', () => {
  test('render mentions as their element, other links as links', async () => {
    const parse = await createMarkdownParser(false, undefined, [mentionPlugin()])
    const { nodes } = await parse('Hi [@Ana](openpencil://person/acc-ana), see [it](https://a.b)')
    expect(JSON.stringify(nodes)).toContain(
      JSON.stringify([COMMENT_MENTION, { target: 'acc-ana' }, '@Ana'])
    )
    expect(JSON.stringify(nodes)).toContain('"href":"https://a.b"')
  })
})
