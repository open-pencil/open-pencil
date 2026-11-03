import { describe, expect, test } from 'bun:test'

import { markdownText } from '@open-pencil/core/text'
import type { CharacterStyleOverride } from '@open-pencil/scene-graph'

const BASE = { fontSize: 24, fontWeight: 500 }

/** Each run's characters with its style, which reads better than offsets. */
function styled(markdown: string, base = BASE): [string, CharacterStyleOverride][] {
  const { text, styleRuns } = markdownText(markdown, base)
  return styleRuns.map((run) => [text.slice(run.start, run.start + run.length), run.style])
}

const HEADING: CharacterStyleOverride = {
  fontWeight: 700,
  lineHeight: { unit: 'PERCENT', value: 150 }
}

describe('Markdown as text, styled as FigJam styles typed Markdown', () => {
  test('headings are bold at 2.5×, 1.5×, and the text’s own size, with a 150% line height', () => {
    expect(styled('# One\n## Two\n### Three\n###### Six')).toEqual([
      ['One\n', { ...HEADING, fontSize: 60 }],
      ['Two\n', { ...HEADING, fontSize: 36 }],
      ['Three\nSix', HEADING]
    ])
    expect(styled('# Big', { fontSize: 40, fontWeight: 400 })).toEqual([
      ['Big', { ...HEADING, fontSize: 100 }]
    ])
  })

  test('emphasis, strikethrough with one tilde or two, and links style their characters', () => {
    const { text } = markdownText('a **b** _c_ ~d~ ~~e~~ [f](https://x.dev)', BASE)
    expect(text).toBe('a b c d e f')
    expect(styled('a **b** _c_ ~d~ ~~e~~ [f](https://x.dev)')).toEqual([
      ['b', { fontWeight: 700 }],
      ['c', { italic: true }],
      ['d', { textDecoration: 'STRIKETHROUGH' }],
      ['e', { textDecoration: 'STRIKETHROUGH' }],
      ['f', { hyperlink: { type: 'URL', value: 'https://x.dev' } }]
    ])
  })

  test('a reference link takes its definition’s URL', () => {
    const source = 'See the [guide][Manual].\n\n[manual]: https://x.dev/guide'
    expect(markdownText(source, BASE).text).toBe('See the guide.')
    expect(styled(source)).toEqual([
      ['guide', { hyperlink: { type: 'URL', value: 'https://x.dev/guide' } }]
    ])
  })

  test('HTML keeps its words, inline or as a block, and a comment leaves nothing', () => {
    expect(markdownText('See <b>this</b>.', BASE).text).toBe('See this.')
    expect(markdownText('<div>\nOne<br>two\n</div>\n\n<!-- note -->\n\nend', BASE).text).toBe(
      'One\ntwo\nend'
    )
  })

  test('code is Roboto Mono, Medium below SemiBold and Bold from it', () => {
    expect(styled('a `b`', { fontSize: 24, fontWeight: 400 })).toEqual([
      ['b', { fontFamily: 'Roboto Mono', fontWeight: 500 }]
    ])
    expect(styled('a `b` **`c`**')).toEqual([
      ['b', { fontFamily: 'Roboto Mono' }],
      ['c', { fontFamily: 'Roboto Mono', fontWeight: 700 }]
    ])
    expect(styled('```\nconst a = 1\n```', { fontSize: 24, fontWeight: 600 })).toEqual([
      ['const a = 1', { fontFamily: 'Roboto Mono', fontWeight: 700 }]
    ])
  })

  test('lists are list paragraphs, nested a level deeper, and quotes are italic', () => {
    const { text, textParagraphs, styleRuns } = markdownText(
      '- one\n  - inner\n1. first\n\n> said',
      BASE
    )
    expect(text).toBe('one\ninner\nfirst\nsaid')
    expect(textParagraphs).toEqual([
      { listType: 'UNORDERED', indentation: 1 },
      { listType: 'UNORDERED', indentation: 2 },
      { listType: 'ORDERED', indentation: 1 }
    ])
    expect(styleRuns).toEqual([{ start: 16, length: 4, style: { italic: true } }])
  })

  test('HTML shows what a browser shows: blocks on lines of their own, no script, a pre’s spaces', () => {
    expect(markdownText('first<br>second', BASE).text).toBe('first\nsecond')
    expect(markdownText('<div>one</div><div>two</div>', BASE).text).toBe('one\ntwo')
    expect(markdownText('<div>a<script>secret()</script><style>p{}</style></div>', BASE).text).toBe('a')
    expect(markdownText('<pre>  indented</pre>', BASE).text).toBe('  indented')
  })

  test('an item holding only a nested list keeps a bullet of its own', () => {
    expect(markdownText('-\n  - child', BASE).textParagraphs).toEqual([
      { listType: 'UNORDERED', indentation: 1 },
      { listType: 'UNORDERED', indentation: 2 }
    ])
  })

  test('an empty list item is a bullet of its own', () => {
    const { text, textParagraphs } = markdownText('- \n- next', BASE)
    expect(text).toBe('\nnext')
    expect(textParagraphs).toEqual([
      { listType: 'UNORDERED', indentation: 1 },
      { listType: 'UNORDERED', indentation: 1 }
    ])
  })

  test('a hard break starts a paragraph, a table row reads as its cells, a rule is left out', () => {
    expect(markdownText('a  \nb\n\n---\n\n| x | y |\n|---|---|\n| 1 | 2 |', BASE).text).toBe(
      'a\nb\nx\ty\n1\t2'
    )
  })

  test('empty Markdown is empty text', () => {
    expect(markdownText('', BASE)).toEqual({ text: '', styleRuns: [], textParagraphs: [] })
  })
})
