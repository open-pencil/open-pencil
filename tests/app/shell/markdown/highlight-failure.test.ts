import { expect, mock, test } from 'bun:test'

import { defineComarkPlugin } from 'comark'

let resets = 0
// A highlighter whose grammar fails to load, as Comark's does when a chunk cannot be fetched.
await mock.module('@/app/shell/markdown/highlight', () => ({
  highlightPlugin: defineComarkPlugin(() => ({
    name: 'failing-highlight',
    post() {
      throw new Error('grammar failed to load')
    }
  }))(),
  resetHighlighter: () => {
    resets++
  }
}))

const { createMarkdownParser } = await import('@/app/shell/markdown/config')

test('a reply whose highlighting fails renders without it, and the next one tries again', async () => {
  const parse = await createMarkdownParser(true)
  const warn = console.warn
  console.warn = () => undefined
  try {
    const document = await parse('Before\n\n```ts\nconst a = 1\n```')
    expect(document.nodes.some((node) => Array.isArray(node) && node[0] === 'pre')).toBe(true)
    expect(resets).toBe(1)
  } finally {
    console.warn = warn
  }
})
