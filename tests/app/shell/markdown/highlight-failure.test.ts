import { expect, test } from 'bun:test'

import { defineComarkPlugin } from 'comark'

import { createMarkdownParser } from '@/app/shell/markdown/config'

test('a reply whose highlighting fails renders without it, and the next one tries again', async () => {
  let resets = 0
  // A highlighter whose grammar fails to load, as Comark's does when a chunk cannot be fetched.
  const failing = defineComarkPlugin(() => ({
    name: 'failing-highlight',
    post() {
      throw new Error('grammar failed to load')
    }
  }))()
  const parse = await createMarkdownParser(true, async () => ({
    plugin: failing,
    reset: () => {
      resets++
    }
  }))
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
